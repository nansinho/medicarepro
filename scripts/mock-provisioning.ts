/* ============================================================
   Sandbox de l'API de provisioning dev B (plan §7.2).

   Reproduit le contrat : auth par header, enveloppe standard,
   201 / 200 idempotent / 400 / 401 / 409 / 5xx / latence.
   Le scénario est piloté par le préfixe de l'email utilisateur :
     409@…     → 409 Conflict (identifiant déjà pris)
     500@…     → 500 (retry côté client)
     flaky@…   → 500 aux 2 premiers appels, 201 ensuite
     badreq@…  → 400 Bad Request
     slow@…    → répond après 20 s (timeout côté client)
     taken@…   → check-availability répond available:false
     (défaut)  → 201 Created (puis 200 idempotent sur rejeu)

   Lancer :  npx tsx scripts/mock-provisioning.ts
   Configurer la vitrine :
     PROVISIONING_API_URL=http://localhost:4545/api/provisioning
     PROVISIONING_API_KEY=mock-key
   ============================================================ */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PROVISIONING_PORT ?? 4545);
const API_KEY = process.env.MOCK_PROVISIONING_KEY ?? "mock-key";

/** idempotencyKey → réponse déjà servie (rejeu → 200 idempotent). */
const provisioned = new Map<string, { cabinetId: string; userId: string }>();
/** Compteur d'échecs pour le scénario flaky@. */
const flakyAttempts = new Map<string, number>();

const json = (data: unknown) => JSON.stringify(data);
const id = () =>
  `cm${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  const respond = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(json(body));
    console.log(`[mock] ${req.method} ${req.url} → ${status}`);
  };

  if (req.headers["x-medicarepro-provision-authorization"] !== API_KEY) {
    return respond(401, { success: false, error: "Clé invalide" });
  }

  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return respond(400, { success: false, error: "JSON invalide" });
  }

  /* ---- POST /api/provisioning/check-availability -------------------- */
  if (req.url?.endsWith("/check-availability") && req.method === "POST") {
    const cabinet = (body.cabinet ?? {}) as Record<string, string>;
    const user = (body.user ?? {}) as Record<string, string>;
    const conflicts: string[] = [];
    if (cabinet.email?.startsWith("taken@")) conflicts.push("cabinet.email");
    if (user.email?.startsWith("taken@")) conflicts.push("user.email");
    return respond(200, {
      success: true,
      data: { available: conflicts.length === 0, conflicts },
    });
  }

  /* ---- POST /api/provisioning/cabinet -------------------------------- */
  if (req.url?.endsWith("/cabinet") && req.method === "POST") {
    const key = String(body.idempotencyKey ?? "");
    const user = (body.user ?? {}) as Record<string, string>;
    const email = user.email ?? "";

    if (!key) {
      return respond(400, {
        success: false,
        error: 'Validation error: [{"path":"idempotencyKey","message":"requis"}]',
      });
    }

    // Idempotence AVANT les scénarios d'erreur (rejeu d'un succès → 200).
    const existing = provisioned.get(key);
    if (existing) {
      return respond(200, {
        success: true,
        message: "Compte déjà provisionné",
        data: {
          alreadyProvisioned: true,
          ...existing,
          loginUrl: "https://app.medicarepro.fr/login",
        },
      });
    }

    if (email.startsWith("409@")) {
      return respond(409, {
        success: false,
        error: "Un cabinet avec cet email existe déjà",
      });
    }
    if (email.startsWith("badreq@")) {
      return respond(400, {
        success: false,
        error: 'Validation error: [{"path":"cabinet.postalCode","message":"5 chiffres"}]',
      });
    }
    if (email.startsWith("500@")) {
      return respond(500, { success: false, error: "Erreur interne" });
    }
    if (email.startsWith("flaky@")) {
      const attempts = (flakyAttempts.get(key) ?? 0) + 1;
      flakyAttempts.set(key, attempts);
      if (attempts <= 2) {
        return respond(500, { success: false, error: `Erreur interne (${attempts}/2)` });
      }
    }
    if (email.startsWith("slow@")) {
      await sleep(20_000);
    }

    const created = { cabinetId: id(), userId: id() };
    provisioned.set(key, created);
    return respond(201, {
      success: true,
      message: "Compte créé et activé",
      data: {
        alreadyProvisioned: false,
        ...created,
        loginUrl: "https://app.medicarepro.fr/login",
      },
    });
  }

  respond(404, { success: false, error: "Route inconnue" });
});

server.listen(PORT, () => {
  console.log(`[mock] API de provisioning simulée sur http://localhost:${PORT}/api/provisioning`);
  console.log(`[mock] clé attendue : ${API_KEY}`);
  console.log(
    "[mock] scénarios par email : 409@ | 500@ | flaky@ | badreq@ | slow@ | taken@",
  );
});

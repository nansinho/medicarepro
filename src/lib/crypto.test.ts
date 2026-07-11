import { describe, expect, it } from "vitest";
import { createCipheriv } from "node:crypto";
import {
  decryptWithKeys,
  encryptWithKeys,
  parseEncryptionKeys,
  timingSafeEqualString,
  type EncryptionKeys,
} from "./crypto";

/* ============================================================
   KAT crypto (gate de merge, plan §7.1) :
   - round-trip chiffrement/déchiffrement
   - vecteur connu (IV figé) → payload déterministe déchiffrable
   - AAD faux → échec
   - keyId inconnu → échec
   - rotation : déchiffre v1, rechiffre v2
   ============================================================ */

const KEY_V1 = Buffer.alloc(32, 1); // clés de test déterministes
const KEY_V2 = Buffer.alloc(32, 2);

const RING_V1: EncryptionKeys = {
  keys: new Map([["v1", KEY_V1]]),
  activeKeyId: "v1",
};
const RING_V1V2: EncryptionKeys = {
  keys: new Map([
    ["v1", KEY_V1],
    ["v2", KEY_V2],
  ]),
  activeKeyId: "v2",
};

describe("parseEncryptionKeys", () => {
  it("parse une liste multi-clés et valide la clé active", () => {
    const raw = `v1:${KEY_V1.toString("base64")},v2:${KEY_V2.toString("base64")}`;
    const ring = parseEncryptionKeys(raw, "v2");
    expect(ring.keys.size).toBe(2);
    expect(ring.activeKeyId).toBe("v2");
    expect(ring.keys.get("v1")?.equals(KEY_V1)).toBe(true);
  });

  it("rejette une clé qui ne fait pas 32 octets", () => {
    expect(() =>
      parseEncryptionKeys(`v1:${Buffer.alloc(16, 1).toString("base64")}`, "v1"),
    ).toThrow(/32 octets/);
  });

  it("rejette un keyId actif absent du trousseau", () => {
    expect(() =>
      parseEncryptionKeys(`v1:${KEY_V1.toString("base64")}`, "v9"),
    ).toThrow(/absent/);
  });
});

describe("encrypt/decrypt AES-256-GCM", () => {
  it("round-trip avec AAD", () => {
    const payload = encryptWithKeys("Sup3rSecret!", "MPABCDEF1234", RING_V1);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(decryptWithKeys(payload, "MPABCDEF1234", RING_V1)).toBe("Sup3rSecret!");
  });

  it("KAT : vecteur connu (IV figé) déchiffrable", () => {
    // Payload construit manuellement avec IV connu — le format doit rester
    // <keyId>:base64(iv[12] || tag[16] || ct) pour toujours.
    const iv = Buffer.alloc(12, 7);
    const cipher = createCipheriv("aes-256-gcm", KEY_V1, iv);
    cipher.setAAD(Buffer.from("RUM-TEST", "utf8"));
    const ct = Buffer.concat([cipher.update("FR7612345", "utf8"), cipher.final()]);
    const payload = `v1:${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64")}`;

    expect(decryptWithKeys(payload, "RUM-TEST", RING_V1)).toBe("FR7612345");
  });

  it("échoue si l'AAD ne correspond pas (payload recopié ailleurs)", () => {
    const payload = encryptWithKeys("secret", "reference-A", RING_V1);
    expect(() => decryptWithKeys(payload, "reference-B", RING_V1)).toThrow();
  });

  it("échoue sur keyId inconnu", () => {
    const payload = encryptWithKeys("secret", "ref", RING_V1);
    const ring = { keys: new Map([["v2", KEY_V2]]), activeKeyId: "v2" };
    expect(() => decryptWithKeys(payload, "ref", ring)).toThrow(/introuvable/);
  });

  it("échoue sur payload altéré", () => {
    const payload = encryptWithKeys("secret", "ref", RING_V1);
    const blob = Buffer.from(payload.slice(3), "base64");
    blob[blob.length - 1] ^= 0xff; // corrompt le dernier octet du ct
    expect(() =>
      decryptWithKeys(`v1:${blob.toString("base64")}`, "ref", RING_V1),
    ).toThrow();
  });

  it("refuse un AAD vide", () => {
    expect(() => encryptWithKeys("x", "", RING_V1)).toThrow(/AAD/);
  });

  it("rotation : déchiffre un payload v1 puis rechiffre avec v2", () => {
    const oldPayload = encryptWithKeys("secret", "ref", RING_V1);
    const clear = decryptWithKeys(oldPayload, "ref", RING_V1V2); // v1 encore au trousseau
    const newPayload = encryptWithKeys(clear, "ref", RING_V1V2); // chiffre avec v2 (active)
    expect(newPayload.startsWith("v2:")).toBe(true);
    expect(decryptWithKeys(newPayload, "ref", RING_V1V2)).toBe("secret");
  });
});

describe("timingSafeEqualString", () => {
  it("compare correctement", () => {
    expect(timingSafeEqualString("abc123", "abc123")).toBe(true);
    expect(timingSafeEqualString("abc123", "abc124")).toBe(false);
    expect(timingSafeEqualString("court", "beaucoup-plus-long")).toBe(false);
  });
});

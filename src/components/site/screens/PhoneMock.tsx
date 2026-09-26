import p from "./phone.module.css";

/**
 * Téléphone posé à côté de l'ordinateur : l'espace patient sur mobile.
 * Dessiné à 180px de large puis mis à l'échelle en CSS (unités de
 * conteneur), comme les écrans de l'ordinateur.
 */
export default function PhoneMock() {
  return (
    <div className={p.box}>
      <div className={p.phone}>
        <div className={p.screen}>
          <div className={p.notch}>
            <i />
          </div>
          <div className={p.body}>
            <h6>Bonjour Mme D.</h6>
            <div className={p.card}>
              <small>Rendez-vous</small>
              <b>Mer. 30 sept · 09:00</b>
              <span>Bilan de suivi</span>
            </div>
            <div className={p.card}>
              <small>Mes semelles</small>
              <b>Délivrées le 14/09</b>
              <span>Contrôle le 14/10</span>
            </div>
            <div className={p.cta}>Prendre rendez-vous</div>
          </div>
        </div>
      </div>
    </div>
  );
}

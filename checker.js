const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_KEY = process.env.JSONBIN_KEY;

const EFTELING_API = "https://www.efteling.com/service/cached/getparksdata";

async function run() {
  try {
    console.log("Start Efteling storing checker...");

    // 0. Controleer of de Secrets aanwezig zijn
    if (!JSONBIN_BIN_ID || !JSONBIN_KEY) {
      console.error("FOUT: GitHub Secrets niet goed doorgegeven!");
      console.log("JSONBIN_BIN_ID aanwezig:", JSONBIN_BIN_ID ? "JA" : "NEE (undefined)");
      console.log("JSONBIN_KEY aanwezig:", JSONBIN_KEY ? "JA" : "NEE (undefined)");
      throw new Error("Missing environment variables from GitHub Secrets.");
    }

    const cleanBinId = JSONBIN_BIN_ID.trim();
    const JSONBIN_API = `https://api.jsonbin.io/v3/b/${cleanBinId}`;

    // 1. Bereken de exacte tijd in Nederland (Europe/Amsterdam)
    const nu = new Date();
    const options = { timeZone: 'Europe/Amsterdam', hour: 'numeric', minute: 'numeric', hour12: false };
    const onderdelen = new Intl.DateTimeFormat('nl-NL', options).formatToParts(nu);
    
    let uurStr = '00', minStr = '00';
    for (const p of onderdelen) {
      if (p.type === 'hour') uurStr = p.value.padStart(2, '0');
      if (p.type === 'minute') minStr = p.value.padStart(2, '0');
    }

    const huidigUur = parseFloat(`${uurStr}.${minStr}`);
    console.log(`Huidige tijd in Nederland: ${uurStr}:${minStr} (Uur: ${huidigUur.toFixed(2)})`);

    // Park open check (tussen 10:00 en 22:00 Nederlandse tijd)
    if (huidigUur < 10.0 || huidigUur >= 22.0) {
      console.log("Park is gesloten (buiten 10:00 - 22:00). Geen meting uitgevoerd.");
      return;
    }

    // 2. Haal de huidige storingshistorie op uit JSONBin
    console.log("Ophalen storingslogboek van JSONBin...");
    const binRes = await fetch(`${JSONBIN_API}/latest`, {
      method: 'GET',
      headers: {
        "X-Master-Key": JSONBIN_KEY
      }
    });

    if (!binRes.ok) {
      const errBody = await binRes.text();
      throw new Error(`Fout bij ophalen JSONBin (${binRes.status} ${binRes.statusText}): ${errBody}`);
    }

    const binData = await binRes.json();
    
    let storingsLogBoek = {};
    if (binData.record && binData.record.storingsLogBoek) {
      storingsLogBoek = binData.record.storingsLogBoek;
    } else if (binData.record) {
      storingsLogBoek = binData.record;
    }

    // 3. Haal de live Efteling data op
    console.log("Ophalen live Efteling data...");
    const eftelRes = await fetch(EFTELING_API, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    if (!eftelRes.ok) {
      throw new Error(`Fout bij ophalen Efteling API: ${eftelRes.statusText}`);
    }

    const eftelData = await eftelRes.json();
    const attracties = eftelData.AttractionList || [];
    let isGewijzigd = false;

    // 4. Controleer elke attractie op storing
    attracties.forEach(r => {
      const state = (r.State || r.state || "").toString().toLowerCase();
      const isOpened = r.IsOpened ?? r.isOpened ?? true;

      const isStoring = state === 'closed' || state === 'down' || state === 'breakdown' || state === 'storing' || isOpened === false;
      const naam = r.Name || r.name;

      if (!naam) return;

      if (!storingsLogBoek[naam]) {
        storingsLogBoek[naam] = [];
      }

      const logLijst = storingsLogBoek[naam];
      let laatsteSessie = logLijst[logLijst.length - 1];

      if (isStoring) {
        if (!laatsteSessie || laatsteSessie.eind !== null) {
          logLijst.push({ start: Number(huidigUur.toFixed(2)), eind: null });
          isGewijzigd = true;
          console.log(`[STORING START] ${naam} om ${uurStr}:${minStr}`);
        }
      } else {
        if (laatsteSessie && laatsteSessie.eind === null) {
          laatsteSessie.eind = Number(huidigUur.toFixed(2));
          isGewijzigd = true;
          console.log(`[STORING OPGELOST] ${naam} om ${uurStr}:${minStr}`);
        }
      }
    });

    // 5. Als er wijzigingen zijn, sla het logboek op in JSONBin
    if (isGewijzigd) {
      console.log("Wijzigingen gedetecteerd. Opslaan in JSONBin...");

      const updateRes = await fetch(JSONBIN_API, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": JSONBIN_KEY
        },
        body: JSON.stringify({ storingsLogBoek })
      });

      if (updateRes.ok) {
        console.log("Storingslogboek succesvol bijgewerkt op JSONBin!");
      } else {
        const updateErr = await updateRes.text();
        console.error("Fout bij opslaan naar JSONBin:", updateErr);
      }
    } else {
      console.log("Geen storingswijzigingen gevonden. Geen update nodig.");
    }

  } catch (error) {
    console.error("Er is een fout ingetreden in het script:", error);
    process.exit(1);
  }
}

run();

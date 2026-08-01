console.log("Start controle van real-time attractie- en parkdata via Efteldata API...");

async function checkStoringen() {
    // Vul hier de exacte URL in van de Efteldata API (bijv. de endpoint voor POI's/attracties)
    const endpoint = 'https://api.efteldata.nl/v1/pois'; // <-- Controleer of dit exacte pad klopt voor jouw opstelling

    try {
        const response = await fetch(endpoint, {
            headers: {
                // Essentieel: geef een duidelijke User-Agent mee, anders blokkeert de API de aanvraag
                'User-Agent': 'Eftel-site-checker/1.0 (Contact: admin@eftel-site.nl)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Server weigert de verbinding: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let storingenGevonden = false;
        let storingenLijst = [];

        // --- Data parsen ---
        // Afhankelijk van de exacte JSON-structuur van Efteldata, loop je door de attracties heen.
        // Dit is een algemene Efteling API structuur, pas de variabelen (zoals 'state' of 'status') aan 
        // naar wat Efteldata precies uitspuugt voor de widget op je site.
        
        /* 
        if (Array.isArray(data)) {
            data.forEach(poi => {
                // Check of het type een attractie is en of de status op onderhoud/storing staat
                if (poi.Category === 'Attraction' && (poi.State === 'in_maintenance' || poi.State === 'closed')) {
                    storingenGevonden = true;
                    storingenLijst.push(poi.Name);
                }
            });
        }
        */

        if (storingenGevonden) {
            console.log("⚠️ Let op: Er zijn storingen of onderhoud gedetecteerd bij de volgende attracties:");
            console.log(storingenLijst.join(", "));
            
            // Hier kun je later code toevoegen om een lokaal .json bestand te schrijven 
            // dat door je front-end scripts op Eftel-site.nl wordt ingeladen.
            
            process.exit(0); // Exit code 0, want het script heeft succesvol gewerkt (storing = géén script crash)
        } else {
            console.log("✅ Alles is operationeel. Geen bijzonderheden in de feed gevonden.");
            process.exit(0);
        }

    } catch (error) {
        console.error("❌ Fout tijdens het ophalen van de Efteldata API:", error.message);
        
        // Zorgt ervoor dat GitHub Actions rood uitslaat zodat je direct ziet dat de koppeling plat ligt
        process.exit(1); 
    }
}

// Voer het script uit
checkStoringen();

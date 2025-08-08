## Obiettivo
Creare una web app per gestire **un’asta di fantacalcio online** per un massimo di 10 partecipanti, con sistema di **offerte a busta chiusa**, gestione in tempo reale e riepilogo squadre e cronologia estrazioni. L’app deve supportare **solo un’asta alla volta** (MVP snello, senza multi-aste) e seguire **un ordine di turno fisso** per i partecipanti.

---
## Stack Tecnologico
- **Frontend**: Next.js (App Router)
- **Styling**: Tailwind CSS + componenti **shadcn/ui**
- **Tema grafico**: bianco e nero, modalità **light** forzata
- **Hosting**: Vercel
- **Backend & Database**: Supabase (Postgres + Auth opzionale)
- **Realtime**: Supabase Realtime per sincronizzazione eventi (estrazioni, offerte, risultati)
- **Struttura progetto**: un singolo repo Next.js con integrazione Supabase

---
## Regole di Gioco
- **Budget iniziale**: ogni partecipante parte con 500 milioni (modificabile in setup)
- **Composizione rosa**: 3 portieri, 8 difensori, 8 centrocampisti, 6 attaccanti (totale 25 giocatori)
- **Tipologia asta**: busta chiusa
  - Per ogni calciatore estratto, ogni partecipante può fare una sola offerta (>0)
  - Vince l’offerta più alta; in caso di pareggio vince chi ha inviato l’offerta prima
- **Vincoli reparto**: se un reparto è completo, il partecipante non può fare offerte per calciatori di quel ruolo
- **Controllo budget**: impedire offerte superiori al budget residuo
- **Ordine di turno**: si segue sempre l’ordine di inserimento dei partecipanti nella creazione dell’asta; una volta arrivati all’ultimo, si ricomincia dal primo (loop continuo)

---
## Funzionalità
### 1) Dashboard
- Creazione nuova asta (solo una alla volta)
- Visualizzazione link univoci per ciascun partecipante

### 2) Creazione nuova asta (/setup)
- Definire partecipanti (min 6, max 10) — solo nome
- Definire budget iniziale (default 500M)
- Caricare CSV calciatori (campi: `nome, ruolo, squadra`)
- Alla creazione:
  - Salvare asta, partecipanti e calciatori in Supabase
  - Generare **link univoco** per ogni partecipante (es. `/join/[token]`)
  - Mostrare all’admin la lista link da condividere

### 3) Asta in corso — Schermata Admin (/auction/[room])
- **Squadre**: elenco squadre con calciatori acquistati e budget residuo
- **Scelta giocatore**: ricerca/autocomplete su lista calciatori non ancora estratti
- **Estrazioni**:
  - Si rispetta l’ordine di turno dei partecipanti
  - L’admin seleziona il calciatore e avvia il timer di 30s
  - Possibilità di saltare un turno e passare al partecipante successivo
- **Log estrazioni**: ultime 30 estrazioni con vincitore e cifra pagata

### 4) Portale partecipante (/p/[token])
- Visualizza nome e budget residuo
- Riceve in tempo reale avviso di nuova estrazione (modale con dati calciatore: nome, ruolo, squadra)
- Può:
  - Inserire la propria offerta (>0)
  - Modificare l’offerta finché il timer è attivo
  - Segnalare “non interessato”
- Alla scadenza dei 30s:
  - Mostra vincitore e tutte le offerte con importi
  - Modale si chiude e attende la prossima estrazione

---
## Flusso Estrazione
1. L’admin seleziona calciatore seguendo l’ordine di turno → evento realtime a tutti i partecipanti
2. Parte timer 30s; i partecipanti inviano/modificano un’offerta (o si dichiarano non interessati)
3. Alla scadenza:
   - Calcolo vincitore (offerta più alta, tie-break prima offerta)
   - Assegnazione calciatore al vincitore
   - Aggiornamento budget vincitore
4. Aggiornamento squadre e log estrazioni in tempo reale
5. Passaggio al partecipante successivo nell’ordine predefinito

---
## Controlli
- Budget ≥ offerta
- Rispetto numero massimo per reparto
- Un solo vincitore per estrazione
- Un solo record di calciatore assegnato
- Rispetto ordine di turno in loop

---
## Modello Dati (Supabase)
- `rooms`: `id`, `code`, `status`, `budget_default`, `created_at`
- `participants`: `id`, `room_id`, `display_name`, `budget`, `join_token`, `join_url`, `turn_order`
- `players`: `id`, `room_id`, `nome`, `ruolo`, `squadra`, `is_assigned`, `assigned_to`
- `bids`: `id`, `room_id`, `player_id`, `participant_id`, `amount`, `created_at`
- Realtime: `player_selected`, `bid_window_closed`, `result_published`

---
## Endpoint principali
- `POST /api/rooms/create` → crea asta, partecipanti (con `turn_order`), calciatori (da CSV), join link
- `POST /api/auction/start` → avvia estrazione e timer
- `POST /api/bids/place` → registra/modifica offerta (validazione budget e ruolo)
- `POST /api/auction/close` → determina vincitore, aggiorna budget, assegna calciatore, pubblica risultato

---
## Acceptance Criteria
1. Creazione asta con partecipanti (in ordine di turno), budget e CSV calciatori
2. Generazione link univoco per ogni partecipante
3. Avvio estrazione seguendo ordine di turno e notifica realtime a tutti i partecipanti
4. Offerte a busta chiusa con possibilità di modifica entro 30s
5. Chiusura estrazione con assegnazione vincitore e aggiornamento budget
6. Rispetto vincoli di budget, composizione squadra e ordine di turno
7. Aggiornamenti in tempo reale di squadre e log estrazioni

---
## Note per Trae
- UI minimale in bianco e nero (light mode forzata)
- shadcn/ui per modali, tabelle, input, upload file CSV
- Implementare realtime con Supabase Realtime
- Parsing CSV lato client e invio dati a Supabase
- Documentare deploy su Vercel
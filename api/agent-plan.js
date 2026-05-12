const DEFAULT_STEPS = [
  { title: 'Analizuję Twój abonament', hint: 'Plan, limity, aktywne usługi' },
  { title: 'Sprawdzam zużycie danych', hint: 'Transfer krajowy i zagraniczny' },
  { title: 'Przeglądam dostępne oferty', hint: 'Promocje i pakiety dodatkowe' },
  { title: 'Przygotowuję odpowiedź', hint: 'Najlepsze rozwiązanie dla Ciebie' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};

  if (!query) return res.status(200).json({ steps: DEFAULT_STEPS });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `Jesteś asystentem Orange Polska. Na podstawie zapytania użytkownika zwróć JSON z listą 3-5 kroków które asystent wykona żeby odpowiedzieć.

Każdy krok: title (co robi asystent, max 5 słów, czasownik w 1os. l.poj.) i hint (konkretne dane których szuka, max 8 słów).

Dostosuj kroki i ich kolejność do kontekstu:
- Zapytanie o TELEFON/SPRZĘT: zacznij od sprawdzenia dostępnych modeli, rat, promocji sprzętowych
- Zapytanie o ABONAMENT/TARYFĘ: zacznij od analizy obecnego planu, limitów, możliwości zmiany
- Zapytanie o RACHUNEK/FAKTURĘ: zacznij od historii płatności, zużycia, opłat dodatkowych
- Zapytanie o ROAMING/ZAGRANICĘ: zacznij od sprawdzenia pakietów zagranicznych, stref, kosztów
- Zapytanie o INTERNET/DATA: zacznij od zużycia transferu, prędkości, pakietów dodatkowych
- Zapytanie o PROMOCJE: zacznij od aktualnych ofert, warunków, okresu ważności

Przykłady tytułów: "Sprawdzam dostępne modele", "Analizuję Twój abonament", "Szukam najlepszej oferty", "Przeglądam historię płatności", "Sprawdzam pakiety roamingowe", "Weryfikuję warunki umowy"

Odpowiedz TYLKO valid JSON bez markdown: { "steps": [{"title": "...", "hint": "..."}] }`,
        messages: [{ role: 'user', content: query }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('agent-plan API error:', response.status, JSON.stringify(data));
      throw new Error(`API ${response.status}`);
    }

    const text = data.content?.[0]?.text || '';
    console.log('agent-plan raw response:', text);

    // Strip markdown code fences if present
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Invalid steps');
    }

    return res.status(200).json({ steps: parsed.steps });
  } catch (err) {
    console.error('agent-plan error:', err);
    return res.status(200).json({ steps: DEFAULT_STEPS });
  }
};

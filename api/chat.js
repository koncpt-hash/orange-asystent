const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callAnthropic(body, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) return { data, status: 200 };

    const isOverloaded = data?.error?.type === 'overloaded_error' ||
      (data?.error?.message || '').toLowerCase().includes('overload');

    if (isOverloaded && attempt < retries - 1) {
      const delay = (attempt + 1) * 1500;
      console.log(`Overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(delay);
      continue;
    }

    return { data, status: response.status };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system } = req.body;

    const { data, status } = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.3,
      system,
      messages,
    });

    if (status !== 200) {
      const msg = data?.error?.message || `API error ${status}`;
      console.error('Anthropic error:', status, msg);
      return res.status(500).json({ error: msg });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
};

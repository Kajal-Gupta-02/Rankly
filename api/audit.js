export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { system, messages } = req.body
  const userMessage = messages?.[0]?.content || ""

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  })
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ""
  res.status(200).json({ content: [{ type: "text", text }] })
}
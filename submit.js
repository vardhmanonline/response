// This function receives survey answers and appends them as a new line
// to a plain JSON-lines file (responses.jsonl) inside a GitHub repo you own.
// Vercel functions can't save files permanently themselves, so GitHub acts
// as your free "flat file" storage that you can open and read anytime.
//
// SETUP (one-time):
// 1. Create a new PRIVATE GitHub repo, e.g. "rajasthani-ras-responses"
// 2. Add an empty file to it called responses.jsonl
// 3. Create a GitHub Personal Access Token (classic) with "repo" scope:
//    https://github.com/settings/tokens
// 4. In your Vercel project settings -> Environment Variables, add:
//    GITHUB_TOKEN   = the token you just created
//    GITHUB_REPO    = yourusername/rajasthani-ras-responses
//    GITHUB_FILE    = responses.jsonl   (or leave unset, defaults below)
//
// To read responses later: open responses.jsonl in your GitHub repo.
// Each line is one response, in plain readable JSON.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
  const GITHUB_FILE = process.env.GITHUB_FILE || 'responses.jsonl';

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return res.status(500).json({ error: 'Server not configured. Missing GITHUB_TOKEN or GITHUB_REPO env vars.' });
  }

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

    // 1. Get current file content + sha (needed to update it)
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
    });

    let existingContent = '';
    let sha = undefined;

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return res.status(500).json({ error: 'Could not read existing file', details: errText });
    }
    // if 404, file doesn't exist yet -> we'll create it

    // 2. Append the new response as one line of JSON
    const newLine = JSON.stringify(req.body) + '\n';
    const updatedContent = existingContent + newLine;

    // 3. Push the updated file back to GitHub
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `New survey response ${new Date().toISOString()}`,
        content: Buffer.from(updatedContent, 'utf-8').toString('base64'),
        sha: sha // omit-safe: undefined is fine when creating a new file
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return res.status(500).json({ error: 'Could not save response', details: errText });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}

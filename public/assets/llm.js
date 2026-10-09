/* ────────────────────────────────────────────────────────────────
   llm.js — optional Gemini back-end for the assistant.

   The browser never sees the API key. It posts to /api/chat — handled
   by the Worker in src/index.js, which holds the key as an environment
   secret and forwards to Google AI Studio's free tier.

   Same origin, so there is no CORS to configure. Anywhere the endpoint
   is missing (local file://, a static-only host, a 404) the call fails and
   the local intent index in assistant.js answers instead — set
   ENDPOINT to '' to skip the attempt entirely.
   ──────────────────────────────────────────────────────────────── */

const LLM = (() => {
  /* Same-origin Pages Function. Set to '' to force the offline index. */
  const ENDPOINT = '/api/chat';
  const TIMEOUT_MS = 12000;

  /* The résumé, flattened once. Small enough to send with every
     request — no retrieval step, no embedding store to maintain. */
  function context() {
    const exp = EXPERIENCE.map(e =>
      `- ${e.company} — ${e.role} (${e.period}) [${e.tag}]\n  ${e.points.join('\n  ')}`).join('\n');
    const proj = PROJECTS.map(p =>
      `- ${p.name} — ${p.kind} [${p.stack.join(', ')}]\n  ${p.points.join('\n  ')}`).join('\n');
    const skills = SKILLS.map(g => `- ${g.group}: ${g.items.join(', ')}`).join('\n');
    const ach = ACHIEVEMENTS.map(a => `- ${a.title} — ${a.detail}`).join('\n');

    return `PROFILE
${PROFILE.name} · ${PROFILE.role} @ ${PROFILE.company} · ${PROFILE.location}
Email ${PROFILE.email} · Phone ${PROFILE.phone} · LinkedIn ${PROFILE.linkedin}
Codeforces ${PROFILE.codeforces} · LeetCode ${PROFILE.leetcode}
${PROFILE.blurb.join(' ')}

EXPERIENCE
${exp}

PROJECTS
${proj}

SKILLS
${skills}

ACHIEVEMENTS
${ach}

EDUCATION
${EDUCATION.school} — ${EDUCATION.degree} (${EDUCATION.period}, ${EDUCATION.detail})`;
  }

  const SYSTEM = `You are the assistant on Shibang Das's portfolio site, answering visitors — usually recruiters or engineers — about his work.

Rules:
- Answer ONLY from the résumé below. If it does not cover something, say so plainly and point at what you can cover. Never invent employers, dates, numbers or ratings.
- Speak about Shibang in the third person. Be concise: two or three short sentences, or a short list. No preamble, no sign-off.
- Plain text only. **bold** is allowed for emphasis; no other markup, no markdown headings, no code fences.
- Set "open" to the workspace file most relevant to your answer, so the site can open it next to the chat. Use exactly one of: home, about, experience, projects, skills, achievements, contact, readme, resume. Use "resume" when asked for the CV/PDF. Use null when nothing fits.

RÉSUMÉ
${'${CONTEXT}'}`;

  async function ask(question, history) {
    if (!ENDPOINT) return null;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          system: SYSTEM.replace('${CONTEXT}', context()),
          history: (history || []).slice(-6),
          question
        })
      });
      if (!res.ok) return null;                       // 429 / 5xx → local index
      const data = await res.json();
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) return null;
      return { answer: data.answer.trim(), open: data.open || null };
    } catch {
      return null;                                   // offline, timeout, CORS
    } finally {
      clearTimeout(timer);
    }
  }

  /* text → safe html: escape everything, then allow **bold** and paragraphs */
  function render(text) {
    const esc = text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return esc.split(/\n{2,}/).map(block => {
      const lines = block.split('\n');
      const bold = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (lines.every(l => /^\s*[-*•]\s+/.test(l)))
        return `<ul>${lines.map(l => `<li>${bold(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${bold(lines.join('<br>'))}</p>`;
    }).join('');
  }

  return { ask, render, enabled: () => !!ENDPOINT };
})();

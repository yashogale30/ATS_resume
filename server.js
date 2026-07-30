const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for generated resume HTML (stateless, cleaned up after 15 min)
const htmlCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, item] of htmlCache.entries()) {
    if (now - item.timestamp > 15 * 60 * 1000) {
      htmlCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Helper: Render Resume HTML from structured JSON (Jake's Resume Format)
function renderResumeHtml(data) {
  if (!data || typeof data !== 'object') {
    data = {};
  }

  const templatePath = path.join(__dirname, 'templates', 'resume-template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const name = data.name || 'Candidate Name';

  // Contact items
  const contactParts = [];
  if (data.contact && typeof data.contact === 'object') {
    if (data.contact.phone) contactParts.push(`<span class="contact-item">${escapeHtml(data.contact.phone)}</span>`);
    if (data.contact.email) contactParts.push(`<span class="contact-item"><a href="mailto:${escapeHtml(data.contact.email)}">${escapeHtml(data.contact.email)}</a></span>`);
    if (data.contact.linkedin) contactParts.push(`<span class="contact-item"><a href="${escapeHtml(formatUrl(data.contact.linkedin))}">${escapeHtml(data.contact.linkedin)}</a></span>`);
    if (data.contact.github) contactParts.push(`<span class="contact-item"><a href="${escapeHtml(formatUrl(data.contact.github))}">${escapeHtml(data.contact.github)}</a></span>`);
    if (data.contact.location) contactParts.push(`<span class="contact-item">${escapeHtml(data.contact.location)}</span>`);
  }
  const contactItems = contactParts.join('');

  // 1. Education Section
  let educationSection = '';
  if (Array.isArray(data.education) && data.education.length > 0) {
    let eduEntriesHtml = '';
    data.education.forEach(edu => {
      if (!edu) return;
      eduEntriesHtml += `
        <div class="entry">
          <div class="entry-row">
            <span class="entry-title">${escapeHtml(edu.school || '')}</span>
            <span class="entry-date">${escapeHtml(edu.location || '')}</span>
          </div>
          <div class="entry-subrow">
            <span>${escapeHtml(edu.degree || '')}</span>
            <span>${escapeHtml(edu.dates || '')}</span>
          </div>
        </div>
      `;
    });
    if (eduEntriesHtml) {
      educationSection = `
        <section class="section">
          <h2 class="section-title">Education</h2>
          ${eduEntriesHtml}
        </section>
      `;
    }
  }

  // 2. Relevant Coursework Section
  let courseworkSection = '';
  if (Array.isArray(data.relevantCoursework) && data.relevantCoursework.length > 0) {
    let courseworkItems = data.relevantCoursework.map(c => `<li>${escapeHtml(c)}</li>`).join('');
    courseworkSection = `
      <section class="section">
        <h2 class="section-title">Relevant Coursework</h2>
        <ul class="coursework-grid">
          ${courseworkItems}
        </ul>
      </section>
    `;
  }

  // 3. Experience Section
  let experienceSection = '';
  if (Array.isArray(data.experience) && data.experience.length > 0) {
    let expEntriesHtml = '';
    data.experience.forEach(exp => {
      if (!exp) return;
      let bulletsHtml = '';
      if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
        bulletsHtml = `<ul class="entry-bullets">` + 
          exp.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') +
          `</ul>`;
      }
      expEntriesHtml += `
        <div class="entry">
          <div class="entry-row">
            <span class="entry-title">${escapeHtml(exp.role || '')}</span>
            <span class="entry-date">${escapeHtml(exp.dates || '')}</span>
          </div>
          <div class="entry-subrow">
            <span>${escapeHtml(exp.company || '')}</span>
            <span>${escapeHtml(exp.location || '')}</span>
          </div>
          ${bulletsHtml}
        </div>
      `;
    });
    if (expEntriesHtml) {
      experienceSection = `
        <section class="section">
          <h2 class="section-title">Experience</h2>
          ${expEntriesHtml}
        </section>
      `;
    }
  }

  // 4. Projects Section
  let projectsSection = '';
  if (Array.isArray(data.projects) && data.projects.length > 0) {
    let projEntriesHtml = '';
    data.projects.forEach(proj => {
      if (!proj) return;
      let bulletsHtml = '';
      if (Array.isArray(proj.bullets) && proj.bullets.length > 0) {
        bulletsHtml = `<ul class="entry-bullets">` + 
          proj.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') +
          `</ul>`;
      }
      projEntriesHtml += `
        <div class="entry">
          <div class="project-row">
            <div>
              <span class="project-title">${escapeHtml(proj.name || '')}</span>
              ${proj.technologies ? ` | <span class="project-stack">${escapeHtml(proj.technologies)}</span>` : ''}
            </div>
            <span class="project-date">${escapeHtml(proj.dates || '')}</span>
          </div>
          ${bulletsHtml}
        </div>
      `;
    });
    if (projEntriesHtml) {
      projectsSection = `
        <section class="section">
          <h2 class="section-title">Projects</h2>
          ${projEntriesHtml}
        </section>
      `;
    }
  }

  // 5. Technical Skills Section
  let skillsSection = '';
  if (Array.isArray(data.skills) && data.skills.length > 0) {
    let skillRowsHtml = '';
    data.skills.forEach(skillGroup => {
      if (!skillGroup) return;
      if (typeof skillGroup === 'string') {
        skillRowsHtml += `
          <div class="skill-row">
            <span class="skill-list">${escapeHtml(skillGroup)}</span>
          </div>
        `;
      } else if (skillGroup && skillGroup.category) {
        const items = Array.isArray(skillGroup.items) ? skillGroup.items.join(', ') : (skillGroup.items || '');
        skillRowsHtml += `
          <div class="skill-row">
            <span class="skill-cat">${escapeHtml(skillGroup.category)}:</span>
            <span class="skill-list">${escapeHtml(items)}</span>
          </div>
        `;
      }
    });
    if (skillRowsHtml) {
      skillsSection = `
        <section class="section">
          <h2 class="section-title">Technical Skills</h2>
          <div class="skills-grid">
            ${skillRowsHtml}
          </div>
        </section>
      `;
    }
  }

  // 6. Leadership Section
  let leadershipSection = '';
  if (Array.isArray(data.leadership) && data.leadership.length > 0) {
    let leadEntriesHtml = '';
    data.leadership.forEach(lead => {
      if (!lead) return;
      let bulletsHtml = '';
      if (Array.isArray(lead.bullets) && lead.bullets.length > 0) {
        bulletsHtml = `<ul class="entry-bullets">` + 
          lead.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') +
          `</ul>`;
      }
      leadEntriesHtml += `
        <div class="entry">
          <div class="entry-row">
            <span class="entry-title">${escapeHtml(lead.role || '')}</span>
            <span class="entry-date">${escapeHtml(lead.dates || '')}</span>
          </div>
          <div class="entry-subrow">
            <span>${escapeHtml(lead.organization || '')}</span>
            <span>${escapeHtml(lead.location || '')}</span>
          </div>
          ${bulletsHtml}
        </div>
      `;
    });
    if (leadEntriesHtml) {
      leadershipSection = `
        <section class="section">
          <h2 class="section-title">Leadership / Extracurricular</h2>
          ${leadEntriesHtml}
        </section>
      `;
    }
  }

  // Replace all section tokens in template
  html = html
    .replace(/{{NAME}}/g, escapeHtml(name))
    .replace(/{{CONTACT_ITEMS}}/g, contactItems)
    .replace(/{{EDUCATION_SECTION}}/g, educationSection)
    .replace(/{{COURSEWORK_SECTION}}/g, courseworkSection)
    .replace(/{{EXPERIENCE_SECTION}}/g, experienceSection)
    .replace(/{{PROJECTS_SECTION}}/g, projectsSection)
    .replace(/{{SKILLS_SECTION}}/g, skillsSection)
    .replace(/{{LEADERSHIP_SECTION}}/g, leadershipSection);

  return html;
}

function formatUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate Endpoint
app.post('/api/generate', async (req, res) => {
  const { resumeText, jobDescription, apiKey } = req.body;

  if (!resumeText || !resumeText.trim()) {
    return res.status(400).json({ error: 'Please provide your current resume text.' });
  }
  if (!jobDescription || !jobDescription.trim()) {
    return res.status(400).json({ error: 'Please provide the target job description.' });
  }
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: 'Please provide your Gemini API Key.' });
  }

  try {
    // Instantiate Gemini SDK with per-request API key (never stored)
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    const prompt = `
You are an expert ATS (Applicant Tracking System) resume reviewer and professional resume writer.
Compare the candidate's original resume text against the target job description.

TASK:
1. BEFORE SCORE: Calculate an initial ATS match score (0-100) for the ORIGINAL resume based on keyword overlap, required hard/soft skills, experience alignment, and formatting/clarity.
2. MISSING GAPS: Identify key missing skills, missing keywords, or weak experience bullet points.
3. REWRITE: Rewrite the resume into the classic "Jake's Resume" template structure to maximize ATS match score and hiring manager impact.
   - Rephrase bullets using strong action verbs + impact metrics + target job keywords.
   - Organize into sections: Education, Relevant Coursework (if applicable), Experience, Projects (if applicable), Technical Skills, Leadership (if applicable).
4. AFTER SCORE: Calculate the predicted ATS match score (0-100) for the NEWLY REWRITTEN resume against the job description.
5. IMPROVEMENTS: Provide a short bullet list of 3-5 concise items explaining exactly what was improved.

Return JSON matching this exact structure:
{
  "beforeScore": 65,
  "missingGaps": ["List item 1", "List item 2"],
  "rewrittenResume": {
    "name": "Full Name",
    "contact": {
      "phone": "(555) 123-4567",
      "email": "email@example.com",
      "linkedin": "linkedin.com/in/username",
      "github": "github.com/username",
      "location": "City, State"
    },
    "education": [
      {
        "school": "University Name",
        "location": "City, State",
        "degree": "B.S. in Computer Science",
        "dates": "Aug 2020 -- May 2024"
      }
    ],
    "relevantCoursework": ["Data Structures", "Algorithms", "Database Systems"],
    "experience": [
      {
        "role": "Job Title",
        "company": "Company Name",
        "location": "City, State",
        "dates": "Jan 2022 -- Present",
        "bullets": [
          "Action verb bullet point with metrics and target keywords..."
        ]
      }
    ],
    "projects": [
      {
        "name": "Project Title",
        "technologies": "React, Node.js, AWS",
        "dates": "Jan 2023 -- Present",
        "bullets": [
          "Developed high-performance web application..."
        ]
      }
    ],
    "skills": [
      {
        "category": "Languages",
        "items": ["Java", "Python", "JavaScript", "SQL"]
      },
      {
        "category": "Frameworks & Tools",
        "items": ["React", "Node.js", "Docker", "Git"]
      }
    ],
    "leadership": [
      {
        "role": "Position Title",
        "organization": "Organization Name",
        "location": "City, State",
        "dates": "Sep 2022 -- May 2023",
        "bullets": [
          "Led team of 10 developers..."
        ]
      }
    ]
  },
  "afterScore": 95,
  "improvements": ["Improvement point 1", "Improvement point 2"]
}

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}
`;

    // Call Gemini API with JSON mode
    let responseText = '';
    const modelCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const modelName of modelCandidates) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        responseText = result.text;
        if (responseText) break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying fallback if available...`, err.message);
      }
    }

    if (!responseText) {
      throw lastError || new Error('Failed to get response from Gemini API');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (e) {
      // Clean up json markup if present
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    }

    // Render HTML template
    const renderedHtml = renderResumeHtml(parsedResult.rewrittenResume);

    // Generate unique ID and cache the rendered HTML
    const htmlId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    htmlCache.set(htmlId, {
      html: renderedHtml,
      filename: `${(parsedResult.rewrittenResume?.name || 'Resume').replace(/\s+/g, '_')}_ATS_Optimized`,
      timestamp: Date.now()
    });

    return res.json({
      success: true,
      beforeScore: parsedResult.beforeScore || 0,
      afterScore: parsedResult.afterScore || 0,
      missingGaps: parsedResult.missingGaps || [],
      improvements: parsedResult.improvements || [],
      rewrittenResume: parsedResult.rewrittenResume,
      htmlId: htmlId
    });

  } catch (error) {
    console.error('Error generating ATS resume:', error);
    let userMsg = 'An error occurred during analysis and generation.';
    
    if (error.message && (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid'))) {
      userMsg = 'Invalid Gemini API Key. Please check your API key and try again.';
    } else if (error.message && error.message.includes('quota')) {
      userMsg = 'Gemini API quota exceeded for this key. Please try again later or use another key.';
    } else if (error.message) {
      userMsg = error.message;
    }

    return res.status(500).json({ error: userMsg });
  }
});

// Resume HTML Preview Route (opens in new tab → user prints → Save as PDF)
app.get('/api/preview-html/:htmlId', (req, res) => {
  const { htmlId } = req.params;
  const item = htmlCache.get(htmlId);

  if (!item) {
    return res.status(404).send('<h2>Resume preview not found or link has expired. Please re-analyze.</h2>');
  }

  // Inject auto-print script and a small helper banner just before </body>
  const printScript = `
  <style>
    @media screen {
      #print-banner {
        position: fixed;
        top: 0; left: 0; right: 0;
        background: #1a1a2e;
        color: #fff;
        padding: 10px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 9999;
        gap: 12px;
      }
      #print-banner span { opacity: 0.85; }
      #print-banner button {
        background: #6c63ff;
        color: #fff;
        border: none;
        padding: 6px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
      }
      #print-banner button:hover { background: #5a52d5; }
      body { padding-top: 48px; }
    }
    @media print {
      #print-banner { display: none !important; }
      body { padding-top: 0 !important; }
    }
  </style>
  <div id="print-banner">
    <span>📄 To save as PDF: In the print dialog, set <strong>Destination → Save as PDF</strong> and set margins to <strong>None</strong> or <strong>Minimum</strong>.</span>
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 600);
    });
  <\/script>`;

  const htmlWithPrint = item.html.replace('</body>', printScript + '\n</body>');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${item.filename}.html"`);
  return res.send(htmlWithPrint);
});

// Fallback catch-all route for Single Page App
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 ATS Resume Fixer running on http://localhost:${PORT}`);
});

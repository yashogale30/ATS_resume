document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const resumeForm = document.getElementById('resumeForm');
  const resumeTextEl = document.getElementById('resumeText');
  const jobDescriptionEl = document.getElementById('jobDescription');
  const apiKeyEl = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  const submitBtn = document.getElementById('submitBtn');

  // Sample Buttons
  const sampleResumeBtn = document.getElementById('sampleResumeBtn');
  const sampleJobBtn = document.getElementById('sampleJobBtn');

  // Error Banner
  const errorBanner = document.getElementById('errorBanner');
  const errorMessage = document.getElementById('errorMessage');
  const closeErrorBtn = document.getElementById('closeErrorBtn');

  // Sections
  const inputSection = document.getElementById('inputSection');
  const loadingSection = document.getElementById('loadingSection');
  const outputSection = document.getElementById('outputSection');
  const loadingStatusText = document.getElementById('loadingStatusText');
  const progressBar = document.getElementById('progressBar');

  // Output Elements
  const beforeScoreVal = document.getElementById('beforeScoreVal');
  const afterScoreVal = document.getElementById('afterScoreVal');
  const scoreDiffVal = document.getElementById('scoreDiffVal');
  const beforeScoreGauge = document.getElementById('beforeScoreGauge');
  const afterScoreGauge = document.getElementById('afterScoreGauge');
  const improvementsList = document.getElementById('improvementsList');
  const gapsList = document.getElementById('gapsList');
  const resumePreviewContent = document.getElementById('resumePreviewContent');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const resetBtn = document.getElementById('resetBtn');

  let currentHtmlId = null;
  let currentCandidateName = 'Resume';

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyEl.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyEl.setAttribute('type', type);
  });

  // Close Error Banner
  closeErrorBtn.addEventListener('click', () => {
    errorBanner.classList.add('hidden');
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }

  // Sample Data Handlers
  sampleResumeBtn.addEventListener('click', () => {
    resumeTextEl.value = `Jake Ryan
(123) 456-7890 | jake@su.edu | linkedin.com/in/jake | github.com/jake | Georgetown, TX

EDUCATION:
Southwestern University - Georgetown, TX
Bachelor of Arts in Computer Science, Minor in Business (Aug. 2018 -- May 2021)

RELEVANT COURSEWORK:
Data Structures, Algorithms, Operating Systems, Database Management, Software Engineering

EXPERIENCE:
Undergraduate Research Assistant at Texas A&M University (June 2020 -- Present) - College Station, TX
- Developed a speech recognition application using Python and PyTorch.
- Trained model on 100+ hours of audio data achieving 94% accuracy.

Software Engineering Intern at Tech Corp (May 2019 -- Aug 2019) - Austin, TX
- Designed REST APIs using Node.js and Express to process 50k+ daily transactions.
- Improved query response times by 35% through SQL optimization.

PROJECTS:
GitStalker | React, Node.js, Express, MongoDB (June 2020 -- Present)
- Developed a full-stack web application to visualize GitHub activity.
- Integrated GitHub REST API with OAuth2 authentication.

TECHNICAL SKILLS:
Languages: Java, Python, C/C++, SQL, JavaScript, HTML/CSS
Frameworks: React, Node.js, Flask, Express
Developer Tools: Git, Docker, GCP, VS Code`;
  });

  sampleJobBtn.addEventListener('click', () => {
    jobDescriptionEl.value = `Software Engineer — Full Stack
Location: Remote / Austin, TX

Responsibilities:
- Build scalable microservices and APIs using Node.js, Express, and TypeScript.
- Develop responsive web applications using React.
- Optimize database queries and schema design in PostgreSQL/SQL.
- Deploy and maintain containerized applications with Docker on GCP/AWS.
- Write clean, unit-tested code in an Agile environment.

Requirements:
- B.S. in Computer Science or related technical field.
- Proficiency in JavaScript, Node.js, React, Python, and SQL.
- Hands-on experience with REST APIs, Git, and Docker.`;
  });

  // Form Submit Handler
  resumeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const resumeText = resumeTextEl.value.trim();
    const jobDescription = jobDescriptionEl.value.trim();
    const apiKey = apiKeyEl.value.trim();

    if (!resumeText) {
      showError('Please paste your current resume text.');
      return;
    }
    if (!jobDescription) {
      showError('Please paste the target job description.');
      return;
    }
    if (!apiKey) {
      showError('Please enter your Gemini API key.');
      return;
    }

    // Show Loading View
    inputSection.classList.add('hidden');
    outputSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    // Progress simulation
    let progress = 15;
    progressBar.style.width = `${progress}%`;
    loadingStatusText.textContent = 'Analyzing keywords and scoring your resume...';

    const progressInterval = setInterval(() => {
      if (progress < 85) {
        progress += Math.floor(Math.random() * 12) + 5;
        if (progress > 85) progress = 85;
        progressBar.style.width = `${progress}%`;

        if (progress > 35 && progress < 65) {
          loadingStatusText.textContent = 'Formatting into Jake\'s Resume layout & aligning keywords...';
        } else if (progress >= 65) {
          loadingStatusText.textContent = 'Rendering PDF document with Puppeteer...';
        }
      }
    }, 1200);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobDescription, apiKey })
      });

      const data = await response.json();
      clearInterval(progressInterval);

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Server error occurred during processing.');
      }

      progressBar.style.width = '100%';
      setTimeout(() => {
        displayResults(data);
      }, 400);

    } catch (err) {
      clearInterval(progressInterval);
      loadingSection.classList.add('hidden');
      inputSection.classList.remove('hidden');
      showError(err.message || 'Failed to analyze and rewrite resume. Check your API key and network.');
    }
  });

  // Display Results
  function displayResults(data) {
    loadingSection.classList.add('hidden');
    outputSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    currentHtmlId = data.htmlId;
    currentCandidateName = data.rewrittenResume?.name || 'Resume';

    // Scores
    const before = data.beforeScore || 0;
    const after = data.afterScore || 0;
    const diff = after - before;

    animateCounter(beforeScoreVal, before);
    animateCounter(afterScoreVal, after);

    scoreDiffVal.textContent = `${diff >= 0 ? '+' : ''}${diff}%`;

    // Visual gauge styling
    if (before >= 75) {
      beforeScoreGauge.className = 'score-circle circle-success';
    } else {
      beforeScoreGauge.className = 'score-circle';
    }

    if (after >= 85) {
      afterScoreGauge.className = 'score-circle circle-success';
    }

    // Improvements List
    improvementsList.innerHTML = '';
    if (Array.isArray(data.improvements) && data.improvements.length > 0) {
      data.improvements.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        improvementsList.appendChild(li);
      });
    } else {
      improvementsList.innerHTML = '<li>Tailored experience bullets to align with target role requirements.</li>';
    }

    // Gaps List
    gapsList.innerHTML = '';
    if (Array.isArray(data.missingGaps) && data.missingGaps.length > 0) {
      data.missingGaps.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        gapsList.appendChild(li);
      });
    } else {
      gapsList.innerHTML = '<li>Identified key industry terms and incorporated metric-driven bullet points.</li>';
    }

    // Render Jake's Resume Structure Preview
    if (data.rewrittenResume) {
      const res = data.rewrittenResume;
      let html = `<div style="text-align: center; margin-bottom: 12px;"><h2 style="margin: 0; font-size: 1.3rem;">${escapeHtml(res.name || 'Candidate Name')}</h2>`;
      
      if (res.contact) {
        const parts = [];
        if (res.contact.phone) parts.push(escapeHtml(res.contact.phone));
        if (res.contact.email) parts.push(escapeHtml(res.contact.email));
        if (res.contact.linkedin) parts.push(escapeHtml(res.contact.linkedin));
        if (res.contact.github) parts.push(escapeHtml(res.contact.github));
        if (res.contact.location) parts.push(escapeHtml(res.contact.location));
        html += `<p style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 4px;">${parts.join(' | ')}</p>`;
      }
      html += `</div>`;

      // Education
      if (Array.isArray(res.education) && res.education.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">EDUCATION</h4>`;
        res.education.forEach(edu => {
          html += `<div style="margin-bottom: 6px;"><strong>${escapeHtml(edu.school || '')}</strong> ${edu.location ? `(${escapeHtml(edu.location)})` : ''}<br><em>${escapeHtml(edu.degree || '')}</em> <span style="float: right;">${escapeHtml(edu.dates || '')}</span></div>`;
        });
      }

      // Coursework
      if (Array.isArray(res.relevantCoursework) && res.relevantCoursework.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">RELEVANT COURSEWORK</h4><p>${res.relevantCoursework.map(c => escapeHtml(c)).join(', ')}</p>`;
      }

      // Experience
      if (Array.isArray(res.experience) && res.experience.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">EXPERIENCE</h4>`;
        res.experience.forEach(exp => {
          html += `<div style="margin-bottom: 10px;"><strong>${escapeHtml(exp.role || '')}</strong> — <em>${escapeHtml(exp.company || '')}</em> <span style="float: right;">${escapeHtml(exp.dates || '')}</span><ul>`;
          if (Array.isArray(exp.bullets)) {
            exp.bullets.forEach(b => {
              html += `<li>${escapeHtml(b)}</li>`;
            });
          }
          html += `</ul></div>`;
        });
      }

      // Projects
      if (Array.isArray(res.projects) && res.projects.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">PROJECTS</h4>`;
        res.projects.forEach(proj => {
          html += `<div style="margin-bottom: 10px;"><strong>${escapeHtml(proj.name || '')}</strong> ${proj.technologies ? `| <em>${escapeHtml(proj.technologies)}</em>` : ''} <span style="float: right;">${escapeHtml(proj.dates || '')}</span><ul>`;
          if (Array.isArray(proj.bullets)) {
            proj.bullets.forEach(b => {
              html += `<li>${escapeHtml(b)}</li>`;
            });
          }
          html += `</ul></div>`;
        });
      }

      // Skills
      if (Array.isArray(res.skills) && res.skills.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">TECHNICAL SKILLS</h4><ul>`;
        res.skills.forEach(s => {
          if (typeof s === 'string') {
            html += `<li>${escapeHtml(s)}</li>`;
          } else if (s && s.category) {
            const items = Array.isArray(s.items) ? s.items.join(', ') : s.items;
            html += `<li><strong>${escapeHtml(s.category)}:</strong> ${escapeHtml(items)}</li>`;
          }
        });
        html += `</ul>`;
      }

      // Leadership
      if (Array.isArray(res.leadership) && res.leadership.length > 0) {
        html += `<h4 style="border-bottom: 1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">LEADERSHIP</h4>`;
        res.leadership.forEach(lead => {
          html += `<div style="margin-bottom: 10px;"><strong>${escapeHtml(lead.role || '')}</strong> — <em>${escapeHtml(lead.organization || '')}</em> <span style="float: right;">${escapeHtml(lead.dates || '')}</span><ul>`;
          if (Array.isArray(lead.bullets)) {
            lead.bullets.forEach(b => {
              html += `<li>${escapeHtml(b)}</li>`;
            });
          }
          html += `</ul></div>`;
        });
      }

      resumePreviewContent.innerHTML = html;
    }
  }

  // Print / Save as PDF Handler
  downloadPdfBtn.addEventListener('click', () => {
    if (!currentHtmlId) {
      showError('Resume not ready yet. Please re-analyze.');
      return;
    }
    const printUrl = `/api/preview-html/${currentHtmlId}`;
    const win = window.open(printUrl, '_blank');
    if (!win) {
      showError('Popup blocked. Please allow popups for this site and try again.');
    }
  });

  // Reset Handler
  resetBtn.addEventListener('click', () => {
    outputSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Number Counter Animation
  function animateCounter(element, target) {
    let current = 0;
    const duration = 1200;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      element.textContent = Math.round(current);
    }, stepTime);
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
});

(function () {
  const STORAGE_KEY = "eegEmotionAssessmentData";
  const PARTICIPANT_KEY = "eegEmotionParticipantId";
  const CONFETTI_KEY = "eegEmotionWelcomeConfettiPlayed";
  const PAGE_COUNT = 19;
  const VIDEO_COUNT = 16;
  const timePoints = Array.from({ length: 10 }, (_, index) => index * 10);
  const healthFields = [
    {
      field: "neurologicalDisease",
      detail: "neurologicalDiseaseDetail",
      title: "您是否患有神经系统疾病（如癫痫、脑卒中、脑肿瘤、帕金森病等）？",
    },
    {
      field: "psychologicalDiagnosis",
      detail: "psychologicalDiagnosisDetail",
      title: "您是否有精神心理疾病诊断史（如抑郁症、焦虑症、精神分裂症、PTSD 等）？",
    },
    {
      field: "headInjury",
      detail: "headInjuryDetail",
      title: "您是否有导致意识丧失或需就医的头部外伤史？",
    },
    {
      field: "cnsMedication",
      detail: "cnsMedicationDetail",
      title: "您目前是否正在服用可能影响中枢神经系统功能的药物（如抗抑郁药、镇静剂、兴奋剂等）？",
    },
  ];

  const state = {
    page: 0,
    answers: loadAnswers(),
    participantId: loadParticipantId(),
    activeTimeline: null,
    transitioning: false,
  };

  const surveyForm = document.getElementById("surveyForm");
  const pageContent = document.getElementById("pageContent");
  const progressLabel = document.getElementById("progressLabel");
  const progressFill = document.getElementById("progressFill");
  const nextButton = document.getElementById("nextButton");
  const saveStatus = document.getElementById("saveStatus");

  nextButton.addEventListener("click", () => {
    if (!isCurrentPageComplete() || state.transitioning) return;
    if (state.page < PAGE_COUNT - 1) {
      goToPage(state.page + 1);
      return;
    }
    submitNetlifyForm();
  });

  window.addEventListener("pointermove", onTimelinePointerMove);
  window.addEventListener("pointerup", () => {
    state.activeTimeline = null;
  });

  syncNetlifyFields();
  renderPage();

  function loadAnswers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAnswers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers));
    syncNetlifyFields();
  }

  function loadParticipantId() {
    return localStorage.getItem(PARTICIPANT_KEY) || "";
  }

  function saveParticipantId(value) {
    state.participantId = value.trim();
    localStorage.setItem(PARTICIPANT_KEY, state.participantId);
    syncNetlifyFields();
  }

  function pageKey() {
    if (state.page === 1) return "participantInfo";
    if (state.page === 2) return "baseline";
    return `video${state.page - 2}`;
  }

  function ensurePageData() {
    if (state.page === 0) return {};
    const key = pageKey();
    if (!state.answers[key]) {
      state.answers[key] = state.page >= 3 ? { timelineArousal: defaultTimeline() } : {};
      saveAnswers();
    }
    if (state.page >= 3 && !state.answers[key].timelineArousal) {
      state.answers[key].timelineArousal = defaultTimeline();
      saveAnswers();
    }
    return state.answers[key];
  }

  function defaultTimeline() {
    return Object.fromEntries(timePoints.map((time) => [time, 5]));
  }

  function renderPage() {
    const data = ensurePageData();
    surveyForm.classList.toggle("landing-mode", state.page === 0);
    surveyForm.classList.toggle("info-mode", state.page === 1);
    surveyForm.classList.toggle("assessment-mode", state.page >= 2);

    if (state.page === 0) {
      progressLabel.textContent = "";
      progressFill.style.width = "0%";
      saveStatus.textContent = "";
      pageContent.innerHTML = landingTemplate();
      bindLanding();
      maybePlayConfetti();
      updateNextButton();
      return;
    }

    const label = state.page === 1 ? "实验准备" : state.page === 2 ? "基线评估" : `影片 ${state.page - 2} / ${VIDEO_COUNT}`;
    progressLabel.textContent = label;
    progressFill.style.width = `${(state.page / (PAGE_COUNT - 1)) * 100}%`;
    saveStatus.textContent = "";
    saveStatus.className = "save-status";

    if (state.page === 1) {
      pageContent.innerHTML = participantInfoTemplate(data);
      bindParticipantInfo(data);
    } else {
      pageContent.innerHTML = state.page === 2 ? baselineTemplate() : videoTemplate();
      bindScales(data);
      if (state.page >= 3) renderTimeline(data);
    }
    updateNextButton();
  }

  function goToPage(nextPage) {
    state.transitioning = true;
    pageContent.classList.add("page-slide-out");
    setTimeout(() => {
      state.page = nextPage;
      renderPage();
      pageContent.classList.remove("page-slide-out");
      pageContent.classList.add("page-slide-in");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        pageContent.classList.remove("page-slide-in");
        state.transitioning = false;
      }, 260);
    }, 180);
  }

  function landingTemplate() {
    return `
      <section class="landing-page" aria-labelledby="landingTitle">
        <div class="confetti-layer" id="confettiLayer" aria-hidden="true"></div>
        <div class="brand-logo landing-fade delay-1" aria-label="NeuroDance">
          <div class="brand-mark">
            <span class="arc arc-yellow"></span>
            <span class="arc arc-orange"></span>
            <span class="arc arc-green"></span>
            <span class="arc arc-blue"></span>
          </div>
          <div class="brand-word">neurodance</div>
        </div>
        <h1 class="landing-title landing-fade delay-2" id="landingTitle">欢迎参加影视情绪模型测试</h1>
        <p class="landing-copy landing-fade delay-3">感谢您参与本次实验。<br>本测试旨在研究影视内容引发的情绪体验，不存在正确或错误答案。<br>请根据您的真实感受进行作答，并尽量保持专注。</p>
        <div class="landing-input-area landing-fade delay-4">
          <label class="field-label" for="participantIdInput">请输入被试 ID</label>
          <input class="text-input participant-input" id="participantIdInput" type="text" value="${escapeHtml(state.participantId)}" placeholder="例如：P001" autocomplete="off" inputmode="latin" />
          <div class="field-error" id="participantIdError"></div>
        </div>
        <button class="start-button landing-fade delay-5" id="startButton" type="button">开启测试</button>
      </section>
    `;
  }

  function bindLanding() {
    const input = document.getElementById("participantIdInput");
    const button = document.getElementById("startButton");
    const error = document.getElementById("participantIdError");

    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^A-Za-z0-9_]/g, "");
      error.textContent = "";
    });

    button.addEventListener("click", () => {
      const value = input.value.trim();
      if (!value) {
        error.textContent = "请先输入被试 ID。";
        input.focus();
        return;
      }
      saveParticipantId(value);
      button.textContent = "正在进入...";
      button.disabled = true;
      setTimeout(() => goToPage(1), 300);
    });
  }

  function maybePlayConfetti() {
    if (localStorage.getItem(CONFETTI_KEY)) return;
    localStorage.setItem(CONFETTI_KEY, "true");
    const layer = document.getElementById("confettiLayer");
    if (!layer) return;
    const colors = ["#1769e0", "#8ac21a", "#ffc21a", "#f2632b"];
    for (let index = 0; index < 96; index += 1) {
      const piece = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const distance = 160 + Math.random() * 360;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance + 180 + Math.random() * 120;
      piece.className = Math.random() > 0.18 ? "confetti-piece" : "confetti-ribbon";
      piece.style.setProperty("--tx", `${tx}px`);
      piece.style.setProperty("--ty", `${ty}px`);
      piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
      piece.style.background = colors[index % colors.length];
      layer.appendChild(piece);
    }
    setTimeout(() => layer.replaceChildren(), 3400);
  }

  function participantInfoTemplate(data) {
    return `
      <div class="info-page">
        <div class="intro">
          <h1 class="page-title">被试基础信息</h1>
          <p class="page-description">为保证实验数据的科学性，请填写以下基础信息。本页面信息仅用于科研分析，将严格保密，不会用于任何身份识别或其他用途。</p>
        </div>
        <section class="info-card card-enter delay-1">
          <h2 class="info-card-title">一、基本信息</h2>
          ${radioRow("性别", "gender", ["男", "女", "其他"], data.gender)}
          ${ageRow(data.age)}
          ${radioRow("惯用手", "handedness", ["右利手", "左利手", "双手通用"], data.handedness)}
        </section>
        <section class="info-card card-enter delay-2">
          <h2 class="info-card-title">二、健康状况筛选</h2>
          <p class="info-card-note">以下信息仅用于判断实验数据是否符合纳入标准，不影响您参与实验，请根据实际情况填写。</p>
          ${healthFields.map((item) => healthRow(item, data)).join("")}
        </section>
        <p class="ethics-note">您填写的信息仅用于科研统计分析，将严格保密，并按照相关科研伦理要求进行匿名化处理。</p>
      </div>
    `;
  }

  function radioRow(label, field, options, selected) {
    return `
      <div class="form-row" data-required-field="${field}">
        <div class="form-row-title">${label}</div>
        <div class="radio-group" role="radiogroup" aria-label="${label}">
          ${options
            .map(
              (option) => `
                <label class="material-radio">
                  <input type="radio" name="${field}" value="${option}" ${selected === option ? "checked" : ""}>
                  <span>${option}</span>
                </label>
              `,
            )
            .join("")}
        </div>
        <div class="field-error row-error"></div>
      </div>
    `;
  }

  function ageRow(age) {
    return `
      <div class="form-row" data-required-field="age">
        <div class="form-row-title">年龄</div>
        <div class="age-input-wrap">
          <input class="text-input age-input" id="ageInput" type="text" value="${age ? escapeHtml(String(age)) : ""}" placeholder="请输入年龄" inputmode="numeric" autocomplete="off">
          <span class="age-unit">周岁</span>
        </div>
        <div class="field-error row-error" id="ageError"></div>
      </div>
    `;
  }

  function healthRow(item, data) {
    const selected = data[item.field];
    const showDetail = selected === "是";
    return `
      <div class="health-row ${showDetail ? "expanded" : ""}" data-health-field="${item.field}" data-detail-field="${item.detail}">
        <div class="health-question">${item.title}</div>
        <div class="radio-group compact" role="radiogroup" aria-label="${item.title}">
          ${["是", "否"]
            .map(
              (option) => `
                <label class="material-radio">
                  <input type="radio" name="${item.field}" value="${option}" ${selected === option ? "checked" : ""}>
                  <span>${option}</span>
                </label>
              `,
            )
            .join("")}
        </div>
        <div class="detail-panel">
          <label class="detail-label">请输入具体情况：</label>
          <input class="text-input detail-input" type="text" value="${escapeHtml(data[item.detail] || "")}" placeholder="请简要说明">
        </div>
        <div class="field-error row-error"></div>
      </div>
    `;
  }

  function bindParticipantInfo(data) {
    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener("change", () => {
        data[input.name] = input.value;
        if (healthFields.some((item) => item.field === input.name)) {
          const row = input.closest(".health-row");
          row.classList.toggle("expanded", input.value === "是");
          if (input.value === "否") {
            const detailField = row.dataset.detailField;
            data[detailField] = "";
            row.querySelector(".detail-input").value = "";
          }
        }
        saveAnswers();
        validateParticipantInfo(false);
        updateNextButton();
      });
    });

    const ageInput = document.getElementById("ageInput");
    ageInput.addEventListener("input", () => {
      ageInput.value = ageInput.value.replace(/\D/g, "").slice(0, 3);
      data.age = ageInput.value;
      saveAnswers();
      validateParticipantInfo(false);
      updateNextButton();
    });

    document.querySelectorAll(".detail-input").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest(".health-row");
        data[row.dataset.detailField] = input.value.trim();
        saveAnswers();
        validateParticipantInfo(false);
        updateNextButton();
      });
    });
  }

  function baselineTemplate() {
    return `
      <div class="content-grid">
        <div class="intro">
          <h1 class="page-title">基线情绪评估</h1>
          <p class="page-description">请根据你此刻观看视频前的真实的情绪状态进行评分。本问卷不存在正确或错误答案，请依据第一感觉作答。</p>
        </div>
        ${scaleQuestion({
          index: 1,
          name: "整体情绪愉悦度（Valence）",
          field: "baselineValence",
          title: "你此刻整体感觉有多愉快？",
          hint: "请根据当前整体情绪的愉悦程度进行评分。",
          left: "非常不愉快",
          right: "非常愉快",
          emojis: ["☹️", "😟", "😐", "🙂", "😄"],
          count: 9,
          start: 1,
        })}
        ${scaleQuestion({
          index: 2,
          name: "整体情绪唤醒度（Arousal）",
          field: "baselineArousal",
          title: "你此刻整体感觉有多兴奋或紧张？",
          hint: "请根据当前整体情绪的唤醒程度进行评分。",
          left: "非常平静",
          right: "非常兴奋、紧张",
          emojis: ["😴", "😔", "😐", "😧", "🤯"],
          count: 9,
          start: 1,
        })}
      </div>
    `;
  }

  function videoTemplate() {
    return `
      <div class="content-grid">
        <div class="intro">
          <h1 class="page-title">情绪评估</h1>
          <p class="page-description">请根据你刚刚观看的视频进行评分。
请依据你的真实感受回答，不需要猜测实验目的，也没有标准答案。</p>
        </div>
        ${scaleQuestion({
          index: 1,
          name: "整体情绪愉悦度（Valence）",
          field: "overallValence",
          title: "整体来看，这段视频让你感觉有多愉快？",
          hint: "请根据当前整体情绪的愉悦程度进行评分。",
          left: "非常不愉快",
          right: "非常愉快",
          emojis: ["☹️", "😟", "😐", "🙂", "😄"],
          count: 9,
          start: 1,
        })}
        ${scaleQuestion({
          index: 2,
          name: "整体情绪唤醒度（Arousal）",
          field: "overallArousal",
          title: "整体来看，这段视频让你感觉有多兴奋、紧张或被激活？",
          hint: "请根据当前整体情绪的唤醒程度进行评分。",
          left: "非常平静",
          right: "非常兴奋、紧张",
          emojis: ["😴", "😔", "😐", "😧", "🤯"],
          count: 9,
          start: 1,
        })}
        <section class="question wide" aria-labelledby="timelineTitle">
          <div class="question-index">问题三</div>
          <div class="question-name">情绪唤醒度时间线</div>
          <h2 class="question-title" id="timelineTitle">请回顾视频过程中每个时间点的兴奋或紧张程度的变化</h2>
          <p class="question-hint">请根据你观看视频时的真实感受，回忆每个时间点的兴奋、紧张或平静程度。
可以先回忆视频中情绪变化较明显的时间点，再完成其他时间点的评分，使整条曲线尽可能反映你观看视频时的情绪变化过程。
请根据第一感觉作答，无需追求完全精确，也无需刻意保持曲线平滑。</p>
          <div class="timeline-wrap">
            <div class="timeline-y-labels" aria-hidden="true">
              ${timelineYAxisTemplate()}
            </div>
            <div class="timeline-area">
              <svg class="timeline-svg" id="timelineSvg" viewBox="0 0 1000 410" role="img" aria-label="0秒到90秒的9档情绪唤醒度时间轴"></svg>
              <div class="timeline-time-labels">
                ${timePoints.map((time) => `<span>${time}s</span>`).join("")}
              </div>
            </div>
          </div>
        </section>
        ${scaleQuestion({
          index: 4,
          name: "熟悉程度（Familiarity）",
          field: "familiarity",
          title: "你之前对这段视频有多熟悉？",
          hint: "请根据你在实验前对这段视频的熟悉程度进行评分。",
          left: "完全没看过",
          right: "非常熟悉",
          emojis: [],
          count: 9,
          start: 1,
        })}
      </div>
    `;
  }

  function scaleQuestion(config) {
    const values = Array.from({ length: config.count }, (_, index) => index + config.start);
    return `
      <section class="question">
        <div class="question-index">${questionLabel(config.index)}</div>
        <div class="question-name">${config.name}</div>
        <h2 class="question-title">${config.title}</h2>
        <p class="question-hint">${config.hint}</p>
        <div class="scale" data-field="${config.field}" data-count="${config.count}" style="--count: ${config.count}">
          <div class="scale-endpoints">
            <span>${config.left}</span>
            <span>${config.right}</span>
          </div>
          ${
            config.emojis.length
              ? `<div class="scale-emojis">${config.emojis.map((emoji) => `<span>${emoji}</span>`).join("")}</div>`
              : ""
          }
          <div class="scale-options">
            ${values
              .map(
                (value) => `
                  <button class="score-option" type="button" data-value="${value}" aria-label="${value}分">
                    <span class="score-dot"></span>
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="score-numbers">
            ${values.map((value) => `<span>${value}</span>`).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function questionLabel(index) {
    return ["", "问题一", "问题二", "问题三", "问题四"][index] || `问题${index}`;
  }

  function timelineYAxisTemplate() {
    const labels = [
      { value: 9, emoji: "🤯" },
      { value: 8, emoji: "" },
      { value: 7, emoji: "😧" },
      { value: 6, emoji: "" },
      { value: 5, emoji: "😐" },
      { value: 4, emoji: "" },
      { value: 3, emoji: "😔" },
      { value: 2, emoji: "" },
      { value: 1, emoji: "😴" },
    ];

    return labels
      .map(
        (label) => `
          <div class="timeline-y-row">
            <span>${label.value}</span>
            <span class="emoji-label">${label.emoji}</span>
          </div>
        `,
      )
      .join("");
  }

  function bindScales(data) {
    document.querySelectorAll(".scale").forEach((scale) => {
      const field = scale.dataset.field;
      const selected = data[field];
      scale.querySelectorAll(".score-option").forEach((button) => {
        if (Number(button.dataset.value) === selected) button.classList.add("selected");
        button.addEventListener("click", () => {
          data[field] = Number(button.dataset.value);
          saveAnswers();
          bindSelectedState(scale, data[field]);
          updateNextButton();
        });
      });
    });
  }

  function bindSelectedState(scale, value) {
    scale.querySelectorAll(".score-option").forEach((button) => {
      button.classList.toggle("selected", Number(button.dataset.value) === value);
    });
  }

  function renderTimeline(data) {
    const svg = document.getElementById("timelineSvg");
    const values = timePoints.map((time) => data.timelineArousal[time] ?? 5);
    const xPositions = timePoints.map((_, index) => 40 + index * (920 / 9));
    const yPositions = Array.from({ length: 9 }, (_, index) => 38 + index * (350 / 8));

    const toY = (value) => yPositions[9 - value];
    const points = values.map((value, index) => `${xPositions[index]},${toY(value)}`).join(" ");

    svg.innerHTML = `
      ${yPositions.map((y) => `<line class="grid-line" x1="40" y1="${y}" x2="960" y2="${y}"></line>`).join("")}
      ${xPositions.map((x) => `<line class="grid-line" x1="${x}" y1="38" x2="${x}" y2="388"></line>`).join("")}
      ${xPositions.map((x) => `<line class="rail-line" x1="${x}" y1="38" x2="${x}" y2="388"></line>`).join("")}
      <polyline class="timeline-polyline" points="${points}"></polyline>
      ${values
        .map((value, index) => {
          const x = xPositions[index];
          const y = toY(value);
          const labelY = Math.max(14, y - 28);
          return `
            <g class="timeline-point" data-index="${index}">
              <rect class="timeline-value-box" x="${x - 13}" y="${labelY - 11}" width="26" height="22" rx="4"></rect>
              <text class="timeline-value-text" x="${x}" y="${labelY + 5}">${value}</text>
              <circle class="timeline-node" tabindex="0" data-index="${index}" cx="${x}" cy="${y}" r="9"></circle>
            </g>
          `;
        })
        .join("")}
    `;

    svg.addEventListener("pointerdown", (event) => {
      const index = nearestTimelineIndex(event, svg, xPositions);
      state.activeTimeline = { svg, index };
      setTimelineValueFromEvent(event, svg, index, data);
      event.preventDefault();
    });

    svg.querySelectorAll(".timeline-node").forEach((node) => {
      node.addEventListener("keydown", (event) => {
        const index = Number(node.dataset.index);
        const time = timePoints[index];
        const current = data.timelineArousal[time] ?? 5;
        if (event.key === "ArrowUp") {
          data.timelineArousal[time] = Math.min(9, current + 1);
        } else if (event.key === "ArrowDown") {
          data.timelineArousal[time] = Math.max(1, current - 1);
        } else {
          return;
        }
        saveAnswers();
        renderTimeline(data);
        updateNextButton();
        event.preventDefault();
      });
    });
  }

  function onTimelinePointerMove(event) {
    if (!state.activeTimeline) return;
    const data = ensurePageData();
    setTimelineValueFromEvent(event, state.activeTimeline.svg, state.activeTimeline.index, data);
  }

  function setTimelineValueFromEvent(event, svg, index, data) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
    const clampedY = Math.max(38, Math.min(388, svgPoint.y));
    const raw = 9 - Math.round(((clampedY - 38) / 350) * 8);
    const value = Math.max(1, Math.min(9, raw));
    data.timelineArousal[timePoints[index]] = value;
    saveAnswers();
    renderTimeline(data);
    state.activeTimeline = { svg: document.getElementById("timelineSvg"), index };
    updateNextButton();
  }

  function nearestTimelineIndex(event, svg, xPositions) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
    let nearest = 0;
    let nearestDistance = Infinity;
    xPositions.forEach((x, index) => {
      const distance = Math.abs(svgPoint.x - x);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function isCurrentPageComplete() {
    if (state.page === 0) return Boolean(state.participantId);
    const data = ensurePageData();
    if (state.page === 1) return validateParticipantInfo(false);
    if (state.page === 2) {
      return Number.isInteger(data.baselineValence) && Number.isInteger(data.baselineArousal);
    }

    return (
      Number.isInteger(data.overallValence) &&
      Number.isInteger(data.overallArousal) &&
      Number.isInteger(data.familiarity) &&
      timePoints.every((time) => Number.isInteger(data.timelineArousal?.[time]))
    );
  }

  function validateParticipantInfo(showErrors) {
    const data = state.answers.participantInfo || {};
    let valid = true;
    const setError = (selector, message) => {
      const element = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (element) element.textContent = showErrors ? message : "";
    };

    if (!data.gender) valid = false;
    if (!data.handedness) valid = false;

    const age = Number(data.age);
    if (!Number.isInteger(age) || age < 16 || age > 100) {
      valid = false;
      setError("#ageError", "请输入 16-100 岁之间的整数年龄。");
    } else {
      setError("#ageError", "");
    }

    healthFields.forEach((item) => {
      const row = document.querySelector(`[data-health-field="${item.field}"]`);
      const error = row?.querySelector(".row-error");
      if (!data[item.field]) {
        valid = false;
        setError(error, "请选择是或否。");
      } else if (data[item.field] === "是" && !String(data[item.detail] || "").trim()) {
        valid = false;
        setError(error, "请补充相关说明。");
      } else {
        setError(error, "");
      }
    });

    return valid;
  }

  function updateNextButton() {
    if (state.page === 0) {
      nextButton.disabled = true;
      nextButton.classList.remove("enabled");
      nextButton.textContent = "下一页";
      return;
    }
    const complete = isCurrentPageComplete();
    nextButton.disabled = !complete;
    nextButton.classList.toggle("enabled", complete);
    nextButton.textContent = state.page === PAGE_COUNT - 1 ? "Submit" : "下一页";
  }

  async function submitNetlifyForm() {
    if (!isExperimentComplete()) return;
    syncNetlifyFields();
    saveStatus.textContent = "正在提交...";
    saveStatus.className = "save-status";
    nextButton.disabled = true;

    try {
      const body = new URLSearchParams(new FormData(surveyForm)).toString();
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!response.ok) throw new Error("Submit failed");
      window.location.href = "/success.html";
    } catch (error) {
      saveStatus.textContent = "提交失败，请联系测试员。";
      saveStatus.className = "save-status error";
      nextButton.disabled = false;
    }
  }

  function syncNetlifyFields() {
    const row = buildSubmissionRow();
    Object.entries(row).forEach(([name, value]) => {
      const field = document.getElementById(`field_${name}`);
      if (field) field.value = value;
    });
  }

  function buildSubmissionRow() {
    const row = Object.fromEntries(getFormFieldNames().map((name) => [name, ""]));
    const info = state.answers.participantInfo || {};
    row.participant_id = state.participantId;
    row.submitted_at = new Date().toISOString();
    row.gender = info.gender || "";
    row.age = info.age || "";
    row.handedness = info.handedness || "";
    row.neurological_disease = info.neurologicalDisease || "";
    row.neurological_disease_detail = info.neurologicalDiseaseDetail || "";
    row.psychological_diagnosis = info.psychologicalDiagnosis || "";
    row.psychological_diagnosis_detail = info.psychologicalDiagnosisDetail || "";
    row.head_injury = info.headInjury || "";
    row.head_injury_detail = info.headInjuryDetail || "";
    row.cns_medication = info.cnsMedication || "";
    row.cns_medication_detail = info.cnsMedicationDetail || "";
    row.baseline_valence = state.answers.baseline?.baselineValence ?? "";
    row.baseline_arousal = state.answers.baseline?.baselineArousal ?? "";

    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      const data = state.answers[`video${video}`] || {};
      row[`video${video}_overall_valence`] = data.overallValence ?? "";
      row[`video${video}_overall_arousal`] = data.overallArousal ?? "";
      timePoints.forEach((time) => {
        row[`video${video}_timeline_arousal_${time}s`] = data.timelineArousal?.[time] ?? "";
      });
      row[`video${video}_familiarity`] = data.familiarity ?? "";
    }

    return row;
  }

  function getFormFieldNames() {
    const names = [
      "participant_id",
      "submitted_at",
      "gender",
      "age",
      "handedness",
      "neurological_disease",
      "neurological_disease_detail",
      "psychological_diagnosis",
      "psychological_diagnosis_detail",
      "head_injury",
      "head_injury_detail",
      "cns_medication",
      "cns_medication_detail",
      "baseline_valence",
      "baseline_arousal",
    ];
    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      names.push(`video${video}_overall_valence`);
      names.push(`video${video}_overall_arousal`);
      timePoints.forEach((time) => {
        names.push(`video${video}_timeline_arousal_${time}s`);
      });
      names.push(`video${video}_familiarity`);
    }
    return names;
  }

  function isExperimentComplete() {
    if (!state.participantId || !validateParticipantInfo(false)) return false;
    const baseline = state.answers.baseline || {};
    if (!Number.isInteger(baseline.baselineValence) || !Number.isInteger(baseline.baselineArousal)) {
      return false;
    }

    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      const data = state.answers[`video${video}`] || {};
      const complete =
        Number.isInteger(data.overallValence) &&
        Number.isInteger(data.overallArousal) &&
        Number.isInteger(data.familiarity) &&
        timePoints.every((time) => Number.isInteger(data.timelineArousal?.[time]));
      if (!complete) return false;
    }

    return true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.getEegEmotionAssessmentData = function () {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  };
})();

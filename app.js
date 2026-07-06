(function () {
  const STORAGE_KEY = "eegEmotionAssessmentData";
  const PARTICIPANT_KEY = "eegEmotionParticipantId";
  const CONFETTI_KEY = "eegEmotionWelcomeConfettiPlayed";
  const VIDEO_COUNT = 8;
  const PAGE_COUNT = 3 + VIDEO_COUNT * 2;
  const HOLD_DURATION_MS = 2000;
  const timePoints = Array.from({ length: 10 }, (_, index) => index * 10);
  const sliderTimePoints = timePoints.slice(1);
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
    transitioning: false,
    hold: null,
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

  function getPageMeta(page = state.page) {
    if (page === 0) return { type: "landing" };
    if (page === 1) return { type: "participantInfo" };
    if (page === 2) return { type: "baseline" };
    const offset = page - 3;
    const video = Math.floor(offset / 2) + 1;
    const step = offset % 2;
    return { type: step === 0 ? "videoPrep" : "videoAssess", video };
  }

  function pageKey(page = state.page) {
    const meta = getPageMeta(page);
    if (meta.type === "participantInfo") return "participantInfo";
    if (meta.type === "baseline") return "baseline";
    if (meta.type === "videoAssess") return `video${meta.video}`;
    return "";
  }

  function ensurePageData() {
    const meta = getPageMeta();
    if (meta.type === "landing" || meta.type === "videoPrep") return {};
    const key = pageKey();
    if (!state.answers[key]) {
      state.answers[key] = meta.type === "videoAssess" ? { timelineArousal: defaultTimeline() } : {};
      saveAnswers();
    }
    if (meta.type === "videoAssess") {
      if (!state.answers[key].timelineArousal) state.answers[key].timelineArousal = defaultTimeline();
      state.answers[key].timelineArousal[0] = 5;
      saveAnswers();
    }
    return state.answers[key];
  }

  function defaultTimeline() {
    return Object.fromEntries(timePoints.map((time) => [time, 5]));
  }

  function renderPage() {
    const meta = getPageMeta();
    const data = ensurePageData();
    surveyForm.classList.toggle("landing-mode", meta.type === "landing");
    surveyForm.classList.toggle("info-mode", meta.type === "participantInfo");
    surveyForm.classList.toggle("assessment-mode", meta.type === "baseline" || meta.type === "videoAssess");
    surveyForm.classList.toggle("prep-mode", meta.type === "videoPrep");
    surveyForm.classList.toggle("video-mode", false);

    if (meta.type === "landing") {
      progressLabel.textContent = "";
      progressFill.style.width = "0%";
      saveStatus.textContent = "";
      pageContent.innerHTML = landingTemplate();
      bindLanding();
      maybePlayConfetti();
      updateNextButton();
      return;
    }

    const label = meta.type === "participantInfo" ? "实验准备" : meta.type === "baseline" ? "基线评估" : `视频 ${meta.video} / ${VIDEO_COUNT}`;
    progressLabel.textContent = label;
    progressFill.style.width = `${(state.page / (PAGE_COUNT - 1)) * 100}%`;
    saveStatus.textContent = "";
    saveStatus.className = "save-status";

    if (meta.type === "participantInfo") {
      pageContent.innerHTML = participantInfoTemplate(data);
      bindParticipantInfo(data);
    } else if (meta.type === "baseline") {
      pageContent.innerHTML = baselineTemplate();
      bindScales(data);
    } else if (meta.type === "videoPrep") {
      pageContent.innerHTML = videoPrepTemplate(meta.video);
      bindVideoPrep(meta.video);
    } else {
      pageContent.innerHTML = videoTemplate();
      bindScales(data);
      renderTimeline(data);
      bindTimelineSliders(data);
    }
    updateNextButton();
  }

  function goToPage(nextPage) {
    if (state.hold?.frame) cancelAnimationFrame(state.hold.frame);
    state.hold = null;
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
          <img class="brand-logo-image" src="./assets/neurodance-logo.png" alt="NeuroDance" />
        </div>
        <h1 class="landing-title landing-fade delay-2" id="landingTitle">欢迎参加影视情绪模型测试</h1>
        <p class="landing-copy landing-fade delay-3">感谢您参与本次实验。<br>本测试旨在研究影视内容引发的情绪体验，不存在正确或错误答案。<br>请根据您的真实感受进行作答，并尽量保持专注。</p>
        <div class="landing-input-area landing-fade delay-4">
          <label class="field-label" for="participantIdInput">请输入被试 ID</label>
          <input class="text-input participant-input" id="participantIdInput" type="text" value="${escapeHtml(state.participantId)}" placeholder="例：s1" autocomplete="off" inputmode="latin" />
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
          ${radioRow("性别", "gender", ["男", "女"], data.gender)}
          ${ageRow(data.age)}
          ${radioRow("惯用手", "handedness", ["右利手", "左利手"], data.handedness)}
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
        ${scaleQuestion({ index: 1, name: "整体情绪愉悦度（Valence）", field: "baselineValence", title: "你此刻整体感觉有多愉快？", hint: "请根据当前整体情绪的愉悦程度进行评分。", left: "非常不愉快", right: "非常愉快", emojis: ["☹️", "😟", "😐", "🙂", "😄"], count: 9, start: 1 })}
        ${scaleQuestion({ index: 2, name: "整体情绪唤醒度（Arousal）", field: "baselineArousal", title: "你此刻整体感觉有多兴奋或紧张？", hint: "请根据当前整体情绪的唤醒程度进行评分。", left: "非常平静", right: "非常兴奋、紧张", emojis: ["😴", "😔", "😐", "😧", "🤯"], count: 9, start: 1 })}
      </div>
    `;
  }

  function videoPrepTemplate(video) {
    return `
      <section class="video-prep-page" aria-labelledby="videoPrepTitle">
        <div class="prep-accent" aria-hidden="true"></div>
        <h1 class="page-title" id="videoPrepTitle">请观看电影片段</h1>
        <p class="prep-copy">请保持专注，完整观看接下来播放的视频内容。观看过程中无需作答。</p>
        <p class="prep-note">长按确认后，系统将进入情绪评估页面。请根据你的真实感受作答。</p>
        <button class="hold-button" id="holdButton" type="button" style="--hold-progress: 0deg" aria-label="长按进入视频 ${video} 情绪评估">
          <span class="hold-button-core">长按进入下一页</span>
        </button>
        <div class="hold-hint" id="holdHint">请长按 2 秒进入下一页</div>
      </section>
    `;
  }

  function bindVideoPrep(video) {
    const button = document.getElementById("holdButton");
    const hint = document.getElementById("holdHint");
    const clearHold = (showHint) => {
      if (!state.hold) return;
      if (state.hold.frame) cancelAnimationFrame(state.hold.frame);
      state.hold = null;
      button.classList.remove("is-holding", "is-complete");
      button.style.setProperty("--hold-progress", "0deg");
      if (showHint) hint.textContent = "请长按 2 秒进入下一页";
    };
    const startHold = (event) => {
      if (state.transitioning || state.hold) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      const startMs = performance.now();
      const startIso = new Date().toISOString();
      hint.textContent = "";
      button.classList.add("is-holding");
      state.hold = { startMs, startIso, frame: null };
      const tick = () => {
        if (!state.hold) return;
        const elapsed = performance.now() - startMs;
        const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
        button.style.setProperty("--hold-progress", `${progress * 360}deg`);
        if (progress >= 1) {
          button.classList.remove("is-holding");
          button.classList.add("is-complete");
          const completeIso = new Date().toISOString();
          state.answers.videoHolds = state.answers.videoHolds || {};
          state.answers.videoHolds[`video${video}`] = {
            participantId: state.participantId,
            videoId: video,
            holdStartTime: startIso,
            holdCompleteTime: completeIso,
            holdDurationMs: Math.round(performance.now() - startMs),
            currentPageName: `video${video}_prep`,
          };
          saveAnswers();
          state.hold = null;
          setTimeout(() => goToPage(state.page + 1), 180);
          return;
        }
        state.hold.frame = requestAnimationFrame(tick);
      };
      state.hold.frame = requestAnimationFrame(tick);
    };
    button.addEventListener("pointerdown", startHold);
    button.addEventListener("pointerup", () => clearHold(true));
    button.addEventListener("pointercancel", () => clearHold(true));
    button.addEventListener("pointerleave", () => clearHold(true));
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  function videoTemplate() {
    return `
      <div class="content-grid">
        <div class="intro">
          <h1 class="page-title">情绪评估</h1>
          <p class="page-description">请根据你刚刚观看的视频进行评分。
请依据你的真实感受回答，不需要猜测实验目的，也没有标准答案。</p>
        </div>
        ${scaleQuestion({ index: 1, name: "整体情绪愉悦度（Valence）", field: "overallValence", title: "整体来看，这段视频让你感觉有多愉快？", hint: "请根据当前整体情绪的愉悦程度进行评分。", left: "非常不愉快", right: "非常愉快", emojis: ["☹️", "😟", "😐", "🙂", "😄"], count: 9, start: 1 })}
        ${scaleQuestion({ index: 2, name: "整体情绪唤醒度（Arousal）", field: "overallArousal", title: "整体来看，这段视频让你感觉有多兴奋、紧张或被激活？", hint: "请根据当前整体情绪的唤醒程度进行评分。", left: "非常平静", right: "非常兴奋、紧张", emojis: ["😴", "😔", "😐", "😧", "🤯"], count: 9, start: 1 })}
        <section class="question wide" aria-labelledby="timelineTitle">
          <div class="question-index">问题三</div>
          <div class="question-name">情绪唤醒度时间线</div>
          <h2 class="question-title" id="timelineTitle">请回顾视频过程中每个时间点的兴奋或紧张程度的变化</h2>
          <p class="question-hint">请根据你观看视频时的真实感受，回忆每个时间点的兴奋、紧张或平静程度，通过拖动下方滑动条调整图中曲线。
可以先回忆视频中情绪变化较明显的时间点，再完成其他时间点的评分，使整条曲线尽可能反映你观看视频时的情绪变化过程。
请根据第一感觉作答，无需追求完全精确，也无需刻意保持曲线平滑。</p>
          <div class="timeline-wrap">
            <div class="timeline-area">
              <svg class="timeline-svg" id="timelineSvg" viewBox="0 0 1120 460" role="img" aria-label="0秒到90秒的9档情绪唤醒度时间轴"></svg>
            </div>
          </div>
          <p class="timeline-slider-instruction">请操作下方滑动条，记录您的实时情绪曲线。</p>
          <div class="timeline-slider-group" id="timelineSliderGroup">
            <div class="timeline-slider-emojis" aria-hidden="true"><span>😴</span><span>😔</span><span>😐</span><span>😧</span><span>🤯</span></div>
            ${sliderTimePoints.map((time) => sliderRowTemplate(time)).join("")}
          </div>
        </section>
        ${scaleQuestion({ index: 4, name: "熟悉程度（Familiarity）", field: "familiarity", title: "你之前对这段视频有多熟悉？", hint: "请根据你在实验前对这段视频的熟悉程度进行评分。", left: "完全没看过", right: "非常熟悉", emojis: [], count: 9, start: 1 })}
      </div>
    `;
  }

  function sliderRowTemplate(time) {
    return `
      <label class="timeline-slider-row">
        <span class="timeline-slider-time">${time}s</span>
        <span class="timeline-slider-control">
          <span class="timeline-slider-bubble" data-time-value="${time}">5</span>
          <input class="timeline-slider" type="range" min="1" max="9" step="1" value="5" data-time="${time}" aria-label="${time}秒情绪唤醒度" />
        </span>
      </label>
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
          <div class="scale-endpoints"><span>${config.left}</span><span>${config.right}</span></div>
          ${config.emojis.length ? `<div class="scale-emojis">${config.emojis.map((emoji) => `<span>${emoji}</span>`).join("")}</div>` : ""}
          <div class="scale-options">
            ${values.map((value) => `<button class="score-option" type="button" data-value="${value}" aria-label="${value}分"><span class="score-dot"></span></button>`).join("")}
          </div>
          <div class="score-numbers">${values.map((value) => `<span>${value}</span>`).join("")}</div>
        </div>
      </section>
    `;
  }

  function questionLabel(index) {
    return ["", "问题一", "问题二", "问题三", "问题四"][index] || `问题${index}`;
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
    data.timelineArousal[0] = 5;
    const svg = document.getElementById("timelineSvg");
    const values = timePoints.map((time) => data.timelineArousal[time] ?? 5);
    const xStart = 112;
    const xEnd = 1080;
    const yStart = 46;
    const yEnd = 396;
    const xPositions = timePoints.map((_, index) => xStart + index * ((xEnd - xStart) / 9));
    const yPositions = Array.from({ length: 9 }, (_, index) => yStart + index * ((yEnd - yStart) / 8));
    const yAxisLabels = [
      { value: 9, emoji: "🤯" }, { value: 8, emoji: "" }, { value: 7, emoji: "😧" }, { value: 6, emoji: "" }, { value: 5, emoji: "😐" }, { value: 4, emoji: "" }, { value: 3, emoji: "😔" }, { value: 2, emoji: "" }, { value: 1, emoji: "😴" },
    ];
    const toY = (value) => yPositions[9 - value];
    const points = values.map((value, index) => `${xPositions[index]},${toY(value)}`).join(" ");
    svg.innerHTML = `
      ${yPositions.map((y) => `<line class="grid-line" x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}"></line>`).join("")}
      ${xPositions.map((x) => `<line class="grid-line" x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}"></line>`).join("")}
      ${xPositions.map((x) => `<line class="rail-line" x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}"></line>`).join("")}
      ${yAxisLabels.map((label) => { const y = toY(label.value); return `<text class="timeline-axis-emoji" x="42" y="${y + 6}">${label.emoji}</text><text class="timeline-axis-number" x="78" y="${y + 6}">${label.value}</text>`; }).join("")}
      ${timePoints.map((time, index) => `<text class="timeline-axis-time" x="${xPositions[index]}" y="438">${time}s</text>`).join("")}
      <polyline class="timeline-polyline" points="${points}"></polyline>
      ${values.map((value, index) => { const x = xPositions[index]; const y = toY(value); const labelY = Math.max(22, y - 30); return `<g class="timeline-point" data-index="${index}"><rect class="timeline-value-box" x="${x - 13}" y="${labelY - 11}" width="26" height="22" rx="4"></rect><text class="timeline-value-text" x="${x}" y="${labelY + 5}">${value}</text><circle class="timeline-node" data-index="${index}" cx="${x}" cy="${y}" r="9"></circle></g>`; }).join("")}
    `;
  }

  function bindTimelineSliders(data) {
    sliderTimePoints.forEach((time) => {
      data.timelineArousal[time] = Number.isInteger(data.timelineArousal[time]) ? data.timelineArousal[time] : 5;
    });
    document.querySelectorAll(".timeline-slider").forEach((slider) => {
      const time = Number(slider.dataset.time);
      const value = data.timelineArousal[time] ?? 5;
      slider.value = value;
      updateSliderVisual(slider, value);
      const valueEl = document.querySelector(`[data-time-value="${time}"]`);
      if (valueEl) valueEl.textContent = value;
      slider.addEventListener("input", () => {
        const snapped = Math.round(Number(slider.value));
        slider.value = snapped;
        data.timelineArousal[0] = 5;
        data.timelineArousal[time] = snapped;
        if (valueEl) valueEl.textContent = snapped;
        updateSliderVisual(slider, snapped);
        saveAnswers();
        renderTimeline(data);
        updateNextButton();
      });
    });
  }

  function updateSliderVisual(slider, value) {
    const percent = ((value - 1) / 8) * 100;
    slider.style.setProperty("--slider-progress", `${percent}%`);
    const control = slider.closest(".timeline-slider-control");
    if (control) control.style.setProperty("--slider-progress", `${percent}%`);
  }

  function isCurrentPageComplete() {
    const meta = getPageMeta();
    if (meta.type === "landing") return Boolean(state.participantId);
    if (meta.type === "videoPrep") return false;
    const data = ensurePageData();
    if (meta.type === "participantInfo") return validateParticipantInfo(false);
    if (meta.type === "baseline") return isScore(data.baselineValence) && isScore(data.baselineArousal);
    return isScore(data.overallValence) && isScore(data.overallArousal) && isScore(data.familiarity) && timePoints.every((time) => isScore(data.timelineArousal?.[time]));
  }

  function isScore(value) {
    return Number.isInteger(value) && value >= 1 && value <= 9;
  }

  function validateParticipantInfo(showErrors) {
    const data = state.answers.participantInfo || {};
    let valid = true;
    const setError = (selector, message) => {
      const element = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (element) element.textContent = showErrors ? message : "";
    };
    if (!["男", "女"].includes(data.gender)) valid = false;
    if (!["右利手", "左利手"].includes(data.handedness)) valid = false;
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
    const meta = getPageMeta();
    if (meta.type === "landing" || meta.type === "videoPrep") {
      nextButton.disabled = true;
      nextButton.classList.remove("enabled");
      nextButton.textContent = "下一页";
      return;
    }
    const complete = isCurrentPageComplete();
    nextButton.disabled = !complete;
    nextButton.classList.toggle("enabled", complete);
    nextButton.textContent = state.page === PAGE_COUNT - 1 ? "提交" : "下一页";
  }

  async function submitNetlifyForm() {
    if (!isExperimentComplete()) return;
    syncNetlifyFields();
    saveStatus.textContent = "正在提交...";
    saveStatus.className = "save-status";
    nextButton.disabled = true;
    try {
      const body = new URLSearchParams(new FormData(surveyForm)).toString();
      const response = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
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
    const holds = state.answers.videoHolds || {};
    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      const hold = holds[`video${video}`] || {};
      const data = state.answers[`video${video}`] || {};
      row[`video${video}_hold_start_time`] = hold.holdStartTime || "";
      row[`video${video}_hold_complete_time`] = hold.holdCompleteTime || "";
      row[`video${video}_hold_duration_ms`] = hold.holdDurationMs ?? "";
      row[`video${video}_hold_page_name`] = hold.currentPageName || "";
      row[`video${video}_overall_valence`] = data.overallValence ?? "";
      row[`video${video}_overall_arousal`] = data.overallArousal ?? "";
      timePoints.forEach((time) => {
        row[`video${video}_timeline_arousal_${time}s`] = time === 0 ? 5 : data.timelineArousal?.[time] ?? "";
      });
      row[`video${video}_familiarity`] = data.familiarity ?? "";
    }
    return row;
  }

  function getFormFieldNames() {
    const names = ["participant_id", "submitted_at", "gender", "age", "handedness", "neurological_disease", "neurological_disease_detail", "psychological_diagnosis", "psychological_diagnosis_detail", "head_injury", "head_injury_detail", "cns_medication", "cns_medication_detail", "baseline_valence", "baseline_arousal"];
    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      names.push(`video${video}_hold_start_time`, `video${video}_hold_complete_time`, `video${video}_hold_duration_ms`, `video${video}_hold_page_name`, `video${video}_overall_valence`, `video${video}_overall_arousal`);
      timePoints.forEach((time) => names.push(`video${video}_timeline_arousal_${time}s`));
      names.push(`video${video}_familiarity`);
    }
    return names;
  }

  function isExperimentComplete() {
    if (!state.participantId || !validateParticipantInfo(false)) return false;
    const baseline = state.answers.baseline || {};
    if (!isScore(baseline.baselineValence) || !isScore(baseline.baselineArousal)) return false;
    for (let video = 1; video <= VIDEO_COUNT; video += 1) {
      const data = state.answers[`video${video}`] || {};
      const timeline = data.timelineArousal || {};
      if (!isScore(data.overallValence) || !isScore(data.overallArousal) || !isScore(data.familiarity)) return false;
      if (!timePoints.every((time) => isScore(time === 0 ? 5 : timeline[time]))) return false;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  window.getEegEmotionAssessmentData = function () {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  };
})();

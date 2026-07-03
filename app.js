(function () {
  const STORAGE_KEY = "eegEmotionAssessmentData";
  const PARTICIPANT_KEY = "eegEmotionParticipantId";
  const PAGE_COUNT = 17;
  const VIDEO_COUNT = 16;
  const timePoints = Array.from({ length: 10 }, (_, index) => index * 10);

  const state = {
    page: 0,
    answers: loadAnswers(),
    participantId: loadParticipantId(),
    activeTimeline: null,
  };

  const surveyForm = document.getElementById("surveyForm");
  const pageContent = document.getElementById("pageContent");
  const progressLabel = document.getElementById("progressLabel");
  const progressFill = document.getElementById("progressFill");
  const nextButton = document.getElementById("nextButton");
  const saveStatus = document.getElementById("saveStatus");

  nextButton.addEventListener("click", () => {
    if (!isCurrentPageComplete()) return;
    if (state.page < PAGE_COUNT - 1) {
      state.page += 1;
      renderPage();
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
    const existing = localStorage.getItem(PARTICIPANT_KEY);
    if (existing) return existing;

    const randomPart =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
        : Math.random().toString(16).slice(2, 14).padEnd(12, "0");
    const participantId = `ND${randomPart.toUpperCase()}`;
    localStorage.setItem(PARTICIPANT_KEY, participantId);
    return participantId;
  }

  function pageKey() {
    return state.page === 0 ? "baseline" : `video${state.page}`;
  }

  function ensurePageData() {
    const key = pageKey();
    if (!state.answers[key]) {
      state.answers[key] =
        state.page === 0
          ? {}
          : { timelineArousal: Object.fromEntries(timePoints.map((time) => [time, 5])) };
      saveAnswers();
    }
    if (state.page > 0 && !state.answers[key].timelineArousal) {
      state.answers[key].timelineArousal = Object.fromEntries(timePoints.map((time) => [time, 5]));
      saveAnswers();
    }
    return state.answers[key];
  }

  function renderPage() {
    const data = ensurePageData();
    const label = state.page === 0 ? "Baseline" : `Video ${state.page} / ${VIDEO_COUNT}`;
    progressLabel.textContent = label;
    progressFill.style.width = `${((state.page + 1) / PAGE_COUNT) * 100}%`;
    saveStatus.textContent = "";
    saveStatus.className = "save-status";

    pageContent.innerHTML = state.page === 0 ? baselineTemplate() : videoTemplate();

    bindScales(data);
    if (state.page > 0) renderTimeline(data);
    updateNextButton();
  }

  function baselineTemplate() {
    return `
      <div class="content-grid">
        <div class="intro">
          <h1 class="page-title">Baseline Emotion Assessment</h1>
          <p class="page-description">请根据你此刻真实的情绪状态进行评分，不需要考虑即将观看的视频。没有正确或错误答案，请按照第一感觉作答。</p>
        </div>
        ${scaleQuestion({
          index: 1,
          name: "Overall Valence",
          field: "baselineValence",
          title: "你此刻整体感觉有多愉快？",
          hint: "请根据你当前整体情绪进行评分。",
          left: "☹️",
          right: "😄",
          emojis: ["☹️", "😟", "😐", "🙂", "😄"],
          count: 9,
          start: 1,
        })}
        ${scaleQuestion({
          index: 2,
          name: "Overall Arousal",
          field: "baselineArousal",
          title: "你此刻整体感觉有多兴奋或紧张？",
          hint: "请根据你当前的激活程度进行评分，而不是愉快程度。",
          left: "😴",
          right: "🤯",
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
          <h1 class="page-title">Emotion Assessment</h1>
          <p class="page-description">请根据你刚刚观看的视频进行评分。
请依据你的真实感受回答，不需要猜测实验目的，也没有标准答案。</p>
        </div>
        ${scaleQuestion({
          index: 1,
          name: "Overall Valence",
          field: "overallValence",
          title: "整体来看，这段视频让你感觉有多愉快？",
          hint: "请根据整段视频带给你的整体感受进行评分。",
          left: "☹️",
          right: "😄",
          emojis: ["☹️", "😟", "😐", "🙂", "😄"],
          count: 9,
          start: 1,
        })}
        ${scaleQuestion({
          index: 2,
          name: "Overall Arousal",
          field: "overallArousal",
          title: "整体来看，这段视频让你感觉有多兴奋、紧张或被激活？",
          hint: "请根据整段视频的整体体验进行评分。",
          left: "😴",
          right: "🤯",
          emojis: ["😴", "😔", "😐", "😧", "🤯"],
          count: 9,
          start: 1,
        })}
        <section class="question wide" aria-labelledby="timelineTitle">
          <div class="question-index">Question 3</div>
          <div class="question-name">Timeline Arousal</div>
          <h2 class="question-title" id="timelineTitle">请回顾视频过程中情绪强度的变化。</h2>
          <p class="question-hint">请回忆观看视频过程中每个时间点的兴奋/紧张程度。
请先找到你认为情绪最强烈的时间点，再找到情绪最低的时间点，最后补充其他时间点，使整条曲线能够真实反映你的情绪变化过程。
请根据你的第一感觉作答，不需要追求完全精确。</p>
          <div class="timeline-wrap">
            <div class="timeline-y-labels" aria-hidden="true">
              ${timelineYAxisTemplate()}
            </div>
            <div class="timeline-area">
              <svg class="timeline-svg" id="timelineSvg" viewBox="0 0 1000 390" role="img" aria-label="0秒到90秒的9档情绪强度时间轴"></svg>
              <div class="timeline-time-labels">
                ${timePoints.map((time) => `<span>${time}s</span>`).join("")}
              </div>
            </div>
          </div>
        </section>
        ${scaleQuestion({
          index: 4,
          name: "Familiarity",
          field: "familiarity",
          title: "你之前对这段视频有多熟悉？",
          hint: "请根据你在实验前对这段视频的熟悉程度进行评分。",
          left: "完全没看过",
          right: "非常熟悉",
          emojis: [],
          count: 10,
          start: 0,
        })}
      </div>
    `;
  }

  function scaleQuestion(config) {
    const values = Array.from({ length: config.count }, (_, index) => index + config.start);
    return `
      <section class="question">
        <div class="question-index">Question ${config.index}</div>
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
        if (Number(button.dataset.value) === selected) {
          button.classList.add("selected");
        }
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
    const yPositions = Array.from({ length: 9 }, (_, index) => 20 + index * (350 / 8));

    const toY = (value) => yPositions[9 - value];
    const points = values.map((value, index) => `${xPositions[index]},${toY(value)}`).join(" ");

    svg.innerHTML = `
      ${yPositions.map((y) => `<line class="grid-line" x1="40" y1="${y}" x2="960" y2="${y}"></line>`).join("")}
      ${xPositions.map((x) => `<line class="grid-line" x1="${x}" y1="20" x2="${x}" y2="370"></line>`).join("")}
      ${xPositions.map((x) => `<line class="rail-line" x1="${x}" y1="20" x2="${x}" y2="370"></line>`).join("")}
      <polyline class="timeline-polyline" points="${points}"></polyline>
      ${values
        .map(
          (value, index) => `
            <circle class="timeline-node" tabindex="0" data-index="${index}" cx="${xPositions[index]}" cy="${toY(value)}" r="9"></circle>
          `,
        )
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
    const clampedY = Math.max(20, Math.min(370, svgPoint.y));
    const raw = 9 - Math.round(((clampedY - 20) / 350) * 8);
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
    const data = ensurePageData();
    if (state.page === 0) {
      return Number.isInteger(data.baselineValence) && Number.isInteger(data.baselineArousal);
    }

    return (
      Number.isInteger(data.overallValence) &&
      Number.isInteger(data.overallArousal) &&
      Number.isInteger(data.familiarity) &&
      timePoints.every((time) => Number.isInteger(data.timelineArousal?.[time]))
    );
  }

  function updateNextButton() {
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
    row.participant_id = state.participantId;
    row.submitted_at = new Date().toISOString();
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
    const names = ["participant_id", "submitted_at", "baseline_valence", "baseline_arousal"];
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

  window.getEegEmotionAssessmentData = function () {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  };
})();

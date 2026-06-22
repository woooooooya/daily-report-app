// 화면에서 사용하는 주요 입력 요소를 한 곳에서 관리합니다.
const reportDateInput = document.querySelector("#reportDate");
const messengerInput = document.querySelector("#messengerInput");
const jiraInput = document.querySelector("#jiraInput");
const reportOutput = document.querySelector("#reportOutput");
const reportForm = document.querySelector("#reportForm");
const apiKeyInput = document.querySelector("#apiKeyInput");
const apiKeyStatus = document.querySelector("#apiKeyStatus");
const saveApiKeyButton = document.querySelector("#saveApiKeyButton");
const deleteApiKeyButton = document.querySelector("#deleteApiKeyButton");
const loadSampleButton = document.querySelector("#loadSampleButton");
const localReportButton = document.querySelector("#localReportButton");
const copyButton = document.querySelector("#copyButton");
const resetButton = document.querySelector("#resetButton");
const downloadButton = document.querySelector("#downloadButton");
const generationMode = document.querySelector("#generationMode");
const reportSummaryContainer = document.querySelector("#reportSummaryContainer");
const reportSummaryTable = document.querySelector("#reportSummaryTable");
const reportBodyContainer = document.querySelector("#reportBodyContainer");
const generatedTime = document.querySelector("#generatedTime");
const storageKey = "securex_api_key";

// OpenAI API 설정
const MODEL_NAME = "gpt-4o-mini";

const sampleFiles = {
  messenger: "messenger_chat_sample.txt",
  jira: "jira_task_sample.csv",
};

// 최초 진입 시 작성일은 브라우저의 현지 날짜로 설정합니다.
reportDateInput.value = getTodayDateString();
updateApiKeyStatus();

// 초기 상태 설정
resetDisplayState();

reportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createAiReport();
});

saveApiKeyButton.addEventListener("click", saveApiKey);
deleteApiKeyButton.addEventListener("click", deleteApiKey);
loadSampleButton.addEventListener("click", loadSampleData);
localReportButton.addEventListener("click", createLocalSampleReport);
copyButton.addEventListener("click", copyReport);
downloadButton.addEventListener("click", downloadReport);
resetButton.addEventListener("click", resetForm);

function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    generationMode.textContent = "보고서 생성 방식: AI 보고서 생성";
    reportOutput.textContent = "API Key를 입력한 뒤 저장해 주세요.";
    return;
  }

  localStorage.setItem(storageKey, apiKey);
  apiKeyInput.value = "";
  updateApiKeyStatus();
  generationMode.textContent = "보고서 생성 방식: AI 보고서 생성";
  reportOutput.textContent = "API Key가 저장되었습니다. 원문은 화면에 표시하지 않습니다.";
}

function deleteApiKey() {
  localStorage.removeItem(storageKey);
  apiKeyInput.value = "";
  updateApiKeyStatus();
  generationMode.textContent = "보고서 생성 방식: AI 보고서 생성";
  reportOutput.textContent = "저장된 API Key가 삭제되었습니다.";
}

function getSavedApiKey() {
  return localStorage.getItem(storageKey) || "";
}

function updateApiKeyStatus() {
  const hasApiKey = Boolean(getSavedApiKey());
  apiKeyStatus.textContent = hasApiKey ? "API Key 설정됨" : "API Key 미설정";
  apiKeyStatus.classList.toggle("saved", hasApiKey);
}

async function loadSampleData() {
  setButtonLoading(loadSampleButton, "불러오는 중...");
  resetDisplayState();

  try {
    const [messengerText, jiraText] = await Promise.all([
      fetchTextFile(sampleFiles.messenger),
      fetchTextFile(sampleFiles.jira),
    ]);

    if (!messengerText || !jiraText) {
      throw new Error("샘플 파일의 내용이 비어 있습니다.");
    }

    messengerInput.value = messengerText.trim();
    jiraInput.value = jiraText.trim();

    const sampleDate = messengerText.match(/일자:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    if (sampleDate) {
      reportDateInput.value = sampleDate;
    }

    generationMode.textContent = "보고서 생성 방식: 샘플 데이터 로드";
    reportOutput.textContent = "✓ 샘플 데이터가 입력되었습니다.\n\n'로컬 샘플 보고서 생성' 또는 'AI 보고서 생성' 버튼을 눌러 결과를 확인하세요.";
  } catch (error) {
    generationMode.textContent = "보고서 생성 방식: 오류 발생";
    reportOutput.textContent =
      "⚠ 샘플 파일을 불러오지 못했습니다.\n\n- 브라우저에서 파일을 직접 열었다면 로컬 웹 서버로 실행해 주세요.\n  (명령어: python -m http.server 8000)\n- messenger_chat_sample.txt와 jira_task_sample.csv 파일이 있는지 확인해 주세요.\n\n오류 내용: " +
      error.message;
  } finally {
    restoreButton(loadSampleButton, "샘플 데이터 불러오기");
  }
}

async function fetchTextFile(filePath) {
  try {
    const response = await fetch(filePath);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`${filePath} 파일을 찾을 수 없습니다. 파일명을 확인해 주세요.`);
      }
      throw new Error(`${filePath} 파일을 불러올 수 없습니다. (상태: ${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error(`${filePath} 파일의 내용이 비어 있습니다.`);
    }
    return decodeKoreanText(buffer);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`네트워크 오류가 발생했습니다. ${filePath} 파일을 불러올 수 없습니다.`);
    }
    throw error;
  }
}

function decodeKoreanText(buffer) {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const eucKrText = new TextDecoder("euc-kr", { fatal: false }).decode(buffer);

  return countBrokenCharacters(eucKrText) < countBrokenCharacters(utf8Text) ? eucKrText : utf8Text;
}

function countBrokenCharacters(text) {
  return (text.match(/\uFFFD|\?⑸|\?댁|\?뺤|\?쇱/g) || []).length;
}

function createReport() {
  const reportDate = reportDateInput.value || "작성일 미지정";
  const messengerText = messengerInput.value.trim();
  const jiraText = jiraInput.value.trim();

  if (!messengerText && !jiraText) {
    reportOutput.textContent = "보고서 생성을 위해 메신저 대화 내용 또는 JIRA 업무 데이터를 입력해 주세요.";
    return;
  }

  const jiraTasks = parseCsv(jiraText);
  const statusSummary = summarizeByField(jiraTasks, "status");
  const prioritySummary = summarizeByField(jiraTasks, "priority");
  const activeTasks = jiraTasks.filter((task) => task.status !== "완료");
  const completedTasks = jiraTasks.filter((task) => task.status === "완료");

  reportOutput.textContent = [
    `SecureX 기술지원팀 일일 업무보고서`,
    `작성일: ${reportDate}`,
    ``,
    `1. 금일 주요 업무`,
    formatTaskList(jiraTasks, "금일 등록된 JIRA 업무가 없습니다."),
    ``,
    `2. 진행 상태 요약`,
    formatSummary(statusSummary, "상태 데이터가 없습니다."),
    ``,
    `3. 우선순위 요약`,
    formatSummary(prioritySummary, "우선순위 데이터가 없습니다."),
    ``,
    `4. 완료 업무`,
    formatTaskList(completedTasks, "완료 처리된 업무가 없습니다."),
    ``,
    `5. 진행 중 및 확인 필요 업무`,
    formatTaskList(activeTasks, "추가 확인이 필요한 진행 업무가 없습니다."),
    ``,
    `6. 메신저 대화 참고 내용`,
    summarizeMessenger(messengerText),
    ``,
    `7. 내일 확인할 항목`,
    formatNextActions(activeTasks),
    ``,
    `※ 본 보고서는 화면 동작 확인용 기본 템플릿으로 생성되었습니다. OpenAI API 요약 기능은 이후 단계에서 연결합니다.`,
  ].join("\n");
}

async function createAiReport() {
  const apiKey = getSavedApiKey();

  generationMode.textContent = "보고서 생성 방식: AI 보고서 생성";
  resetDisplayState();

  if (!apiKey) {
    reportOutput.textContent = "⚠ API Key가 설정되지 않았습니다.\n\n1. 위의 'OpenAI API Key' 입력란에 API Key를 붙여 넣기합니다.\n2. 'API Key 저장' 버튼을 클릭합니다.\n3. 다시 'AI 보고서 생성' 버튼을 클릭합니다.\n\nOpenAI API Key는 https://platform.openai.com/api-keys 에서 발급 받을 수 있습니다.";
    updateApiKeyStatus();
    return;
  }

  const reportDate = reportDateInput.value || "작성일 미지정";
  const messengerText = messengerInput.value.trim();
  const jiraText = jiraInput.value.trim();

  if (!messengerText && !jiraText) {
    reportOutput.textContent = "⚠ AI 보고서 생성을 위해 다음 중 하나 이상을 입력해 주세요.\n\n1. 메신저 대화 내용 입력\n2. JIRA 업무 데이터 입력(CSV 형식)\n\n'샘플 데이터 불러오기' 버튼으로 예제를 시험해볼 수 있습니다.";
    return;
  }

  const aiReportButton = document.querySelector("#aiReportButton");
  setButtonLoading(aiReportButton, "AI 보고서를 생성 중입니다...");

  try {
    reportOutput.textContent = "AI 보고서를 생성 중입니다...";

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(reportDate, messengerText, jiraText);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
    } catch (fetchError) {
      throw new Error("OpenAI API 서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요.");
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error("OpenAI API 응답을 처리할 수 없습니다. 나중에 다시 시도해 주세요.");
    }

    if (!response.ok) {
      const errorMessage = getErrorMessage(response.status, result);
      throw new Error(errorMessage);
    }

    const reportContent = extractAiResponse(result);
    if (!reportContent) {
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    reportOutput.textContent = reportContent;
    
    // 요약표 생성
    generateSummaryTable(messengerText, jiraText, reportDate);
    
    // 컨테이너 표시
    reportBodyContainer.style.display = "flex";
    reportSummaryContainer.style.display = "flex";
    
    // 생성 시각 표시
    displayGeneratedTime();
  } catch (error) {
    reportOutput.textContent = `⚠ 보고서 생성 중 문제가 발생했습니다.\n\n${error.message}\n\n입력값과 API Key를 확인해 주세요.`;
    reportSummaryContainer.style.display = "none";
    reportBodyContainer.style.display = "flex";
    generatedTime.style.display = "none";
  } finally {
    restoreButton(aiReportButton, "AI 보고서 생성");
  }
}

function buildSystemPrompt() {
  return `당신은 SecureX 기술지원팀의 일일 업무보고서를 작성하는 전문 보조자입니다.

규칙:
1. 입력된 메신저 대화와 JIRA 데이터만을 근거로 보고서를 작성하세요.
2. 입력 데이터에 없는 내용을 추측하거나 추가하지 마세요.
3. 사실관계가 명확하지 않은 부분은 "추가 확인 필요"라고 표시하세요.
4. 고객명, 계정명, IP 주소, 내부 URL, API Key 같은 민감정보를 발견하면 "마스킹 필요 - [정보종류]"라고 표시하세요.
5. 팀장에게 공유할 수 있는 전문적인 업무보고서 톤으로 작성하세요.
6. 각 섹션은 명확한 구분선 없이 섹션명 하나로만 표시하세요.
7. 내용이 없는 섹션도 "해당 사항 없음" 또는 "추가 확인 필요"로 반드시 채우세요.`;
}

function buildUserPrompt(reportDate, messengerText, jiraText) {
  const sections = [
    `작성일: ${reportDate}`,
    ``,
    `아래 형식을 정확히 따르세요:`,
    ``,
    `[일일 업무 요약]`,
    `[주요 완료 업무]`,
    `[진행 중 업무]`,
    `[지연/이슈 사항]`,
    `[내일 예정 업무]`,
    `[지원 필요 사항]`,
    `[내부 공유 메모]`,
    ``,
    `===== 입력 데이터 =====`,
    ``,
    `[메신저 대화 내용]`,
    messengerText || "(입력 없음)",
    ``,
    `[JIRA 업무 데이터]`,
    jiraText || "(입력 없음)",
  ];

  return sections.join("\n");
}

function extractAiResponse(result) {
  if (result.choices && result.choices.length > 0) {
    const message = result.choices[0].message;
    if (message && message.content) {
      return message.content.trim();
    }
  }

  return null;
}

function getErrorMessage(status, result) {
  if (status === 401) {
    return "API Key가 유효하지 않습니다.";
  }

  if (status === 429) {
    return "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (status >= 500) {
    return "OpenAI 서버 오류입니다. 잠시 후 다시 시도해 주세요.";
  }

  if (result.error && result.error.message) {
    return result.error.message;
  }

  return "보고서 생성 중 문제가 발생했습니다. 입력값과 API Key를 확인해 주세요.";
}

function createLocalSampleReport() {
  const reportDate = reportDateInput.value || "작성일 미지정";
  const messengerText = messengerInput.value.trim();
  const jiraText = jiraInput.value.trim();

  if (!messengerText && !jiraText) {
    generationMode.textContent = "보고서 생성 방식: 로컬 샘플 생성";
    reportOutput.textContent =
      "⚠ 로컬 샘플 보고서를 생성하려면 다음 중 하나 이상을 입력해 주세요.\n\n1. 메신저 대화 내용 입력\n2. JIRA 업무 데이터 입력(CSV 형식)\n\n'샘플 데이터 불러오기' 버튼을 누르면 API Key 없이 바로 테스트할 수 있습니다.";
    resetDisplayState();
    return;
  }

  const jiraTasks = parseCsv(jiraText);
  const completedTasks = jiraTasks.filter((task) => task.status === "완료");
  const inProgressTasks = jiraTasks.filter((task) => ["진행 중", "모니터링", "예정"].includes(task.status));
  const blockedTasks = jiraTasks.filter((task) => ["대기"].includes(task.status) || hasIssueKeyword(task));
  const highPriorityTasks = jiraTasks.filter((task) => task.priority === "High");
  const tomorrowTasks = jiraTasks.filter((task) => task.next_action || task.due_date);
  const messengerSummary = analyzeMessenger(messengerText);

  generationMode.textContent = "보고서 생성 방식: 로컬 샘플 생성";
  reportOutput.textContent = [
    `작성일: ${reportDate}`,
    `안내: 이 로컬 샘플 보고서는 OpenAI API를 호출하지 않으며 API Key 없이 실행 가능합니다.`,
    ``,
    `[일일 업무 요약]`,
    `- JIRA 기준 전체 업무 ${jiraTasks.length}건, 완료 ${completedTasks.length}건, 진행/모니터링/예정 ${inProgressTasks.length}건, 대기 또는 이슈 ${blockedTasks.length}건입니다.`,
    `- 우선순위 High 업무는 ${highPriorityTasks.length}건이며, 내일 확인이 필요한 후속 조치 후보는 ${tomorrowTasks.length}건입니다.`,
    `- 메신저 대화에서는 시간대별 발언 ${messengerSummary.timedLineCount}건과 이슈 관련 키워드 ${messengerSummary.issueKeywordCount}건을 확인했습니다.`,
    ``,
    `[주요 완료 업무]`,
    formatLocalTaskList(completedTasks, "완료로 표시된 업무가 없습니다."),
    ``,
    `[진행 중 업무]`,
    formatLocalTaskList(inProgressTasks, "진행 중인 업무가 없습니다."),
    ``,
    `[지연/이슈 사항]`,
    formatLocalTaskList(blockedTasks, "대기 또는 이슈로 분류된 업무가 없습니다."),
    ``,
    `[내일 예정 업무]`,
    formatLocalNextActions(tomorrowTasks),
    ``,
    `[지원 필요 사항]`,
    formatSupportNeeds(blockedTasks, highPriorityTasks),
    ``,
    `[내부 공유 메모]`,
    `- 우선순위 High 업무는 먼저 상태 변경 여부를 확인하고 고객 커뮤니케이션 필요 여부를 정리해야 합니다.`,
    `- 메신저 원문과 JIRA 상태가 다른 항목은 실제 보고 전 담당자에게 최종 확인이 필요합니다.`,
    `- OpenAI API 연결 전 단계이므로 문장 품질보다 데이터 분류와 화면 동작 확인을 목적으로 합니다.`,
  ].join("\n");
  
  // 요약표 생성
  generateSummaryTable(messengerText, jiraText, reportDate);
  
  // 컨테이너 표시
  reportSummaryContainer.style.display = "flex";
  reportBodyContainer.style.display = "flex";
  
  // 생성 시각 표시
  displayGeneratedTime();
}

function parseCsv(csvText) {
  if (!csvText) {
    return [];
  }

  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  const headers = (rows.shift() || []).map((header) => header.replace(/^\uFEFF/, ""));

  return rows.map((row) =>
    headers.reduce((task, header, index) => {
      task[header] = row[index] || "";
      return task;
    }, {}),
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === `"` && nextChar === `"`) {
      current += `"`;
      index += 1;
    } else if (char === `"`) {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function summarizeByField(tasks, fieldName) {
  return tasks.reduce((summary, task) => {
    const value = task[fieldName] || "미지정";
    summary[value] = (summary[value] || 0) + 1;
    return summary;
  }, {});
}

function hasIssueKeyword(task) {
  const issueText = `${task.status || ""} ${task.priority || ""} ${task.issue_summary || ""} ${task.next_action || ""}`;
  return /이슈|오류|실패|차단|대기|미적용|경고|확인 필요|잔여/.test(issueText);
}

function analyzeMessenger(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const timedLineCount = lines.filter((line) => /^\d{2}:\d{2}/.test(line)).length;
  const issueKeywordCount = lines.filter((line) => /실패|Offline|탐지|경고|차단|오류|이슈|확인/.test(line)).length;

  return {
    timedLineCount,
    issueKeywordCount,
  };
}

function formatLocalTaskList(tasks, emptyMessage) {
  if (!tasks.length) {
    return `- ${emptyMessage}`;
  }

  return tasks
    .map((task) => {
      const ticket = task.ticket_id || "티켓 없음";
      const title = task.title || "제목 없음";
      const owner = task.owner || "담당자 미지정";
      const status = task.status || "상태 미지정";
      const priority = task.priority || "우선순위 미지정";
      const progress = task.progress || "진척도 미지정";
      const issue = task.issue_summary || "이슈 요약 없음";

      return `- [${ticket}] ${title} / 담당: ${owner} / 상태: ${status} / 우선순위: ${priority} / 진척도: ${progress}\n  확인 내용: ${issue}`;
    })
    .join("\n");
}

function formatLocalNextActions(tasks) {
  const actionTasks = tasks.filter((task) => task.next_action);

  if (!actionTasks.length) {
    return "- 내일 확인해야 할 후속 조치가 없습니다.";
  }

  return actionTasks
    .map((task) => {
      const ticket = task.ticket_id || "티켓 없음";
      const title = task.title || "제목 없음";
      const dueDate = task.due_date ? ` / 기한: ${task.due_date}` : "";
      return `- [${ticket}] ${title}${dueDate}\n  다음 조치: ${task.next_action}`;
    })
    .join("\n");
}

function formatSupportNeeds(blockedTasks, highPriorityTasks) {
  const supportTargets = [...new Map([...blockedTasks, ...highPriorityTasks].map((task) => [task.ticket_id, task])).values()];

  if (!supportTargets.length) {
    return "- 현재 별도 지원 요청이 필요한 업무가 없습니다.";
  }

  return supportTargets
    .map((task) => {
      const ticket = task.ticket_id || "티켓 없음";
      const customer = task.customer || "고객 미지정";
      const system = task.related_system || "시스템 미지정";
      const action = task.next_action || "담당자 확인 필요";

      return `- [${ticket}] ${customer} / ${system}: ${action}`;
    })
    .join("\n");
}

function formatSummary(summary, emptyMessage) {
  const entries = Object.entries(summary);

  if (!entries.length) {
    return `- ${emptyMessage}`;
  }

  return entries.map(([name, count]) => `- ${name}: ${count}건`).join("\n");
}

function formatTaskList(tasks, emptyMessage) {
  if (!tasks.length) {
    return `- ${emptyMessage}`;
  }

  return tasks
    .map((task) => {
      const ticket = task.ticket_id || "티켓 없음";
      const title = task.title || "제목 없음";
      const owner = task.owner || "담당자 미지정";
      const status = task.status || "상태 미지정";
      const priority = task.priority || "우선순위 미지정";
      const progress = task.progress || "진척도 미지정";
      const issue = task.issue_summary || "이슈 요약 없음";

      return `- [${ticket}] ${title} / 담당: ${owner} / 상태: ${status} / 우선순위: ${priority} / 진척도: ${progress}\n  이슈: ${issue}`;
    })
    .join("\n");
}

function formatNextActions(tasks) {
  if (!tasks.length) {
    return "- 내일 추가 확인할 진행 업무가 없습니다.";
  }

  return tasks
    .map((task) => {
      const ticket = task.ticket_id || "티켓 없음";
      const action = task.next_action || "후속 조치 미정";
      return `- [${ticket}] ${action}`;
    })
    .join("\n");
}

function summarizeMessenger(text) {
  if (!text) {
    return "- 메신저 대화 내용이 입력되지 않았습니다.";
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const discussionLines = lines.filter((line) => /^\d{2}:\d{2}/.test(line));
  const previewLines = discussionLines.length ? discussionLines : lines.slice(0, 6);

  return [
    `- 입력된 메신저 원문: ${lines.length}줄`,
    `- 시간대별 발언 후보: ${discussionLines.length}건`,
    `- 참고 발언 미리보기:`,
    ...previewLines.slice(0, 5).map((line) => `  · ${line}`),
  ].join("\n");
}

async function copyReport() {
  const markdownReport = generateMarkdownReport();

  if (!markdownReport) {
    reportOutput.textContent = "⚠ 복사할 보고서가 없습니다.\n\n먼저 보고서를 생성해 주세요.";
    return;
  }

  try {
    await navigator.clipboard.writeText(markdownReport);
    setButtonLoading(copyButton, "✓ 복사 완료");
    window.setTimeout(() => restoreButton(copyButton, "보고서 복사"), 1200);
  } catch (error) {
    reportOutput.textContent += "\n\n⚠ 클립보드 접근 권한이 없습니다.\n마우스로 직접 텍스트를 선택한 후 Ctrl+C로 복사해 주세요.";
  }
}

function resetForm() {
  reportDateInput.value = getTodayDateString();
  messengerInput.value = "";
  jiraInput.value = "";
  generationMode.textContent = "보고서 생성 방식: 아직 생성되지 않음";
  reportSummaryContainer.style.display = "none";
  reportSummaryTable.querySelector("tbody").innerHTML = "";
  generatedTime.style.display = "none";
  generatedTime.textContent = "";
  resetDisplayState();
}

function resetDisplayState() {
  reportBodyContainer.style.display = "flex";
  reportOutput.textContent = "작성일, 메신저 대화 내용, JIRA 업무 데이터를 입력한 뒤 보고서 생성 버튼을 눌러 주세요.";
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setButtonLoading(button, text) {
  button.dataset.originalText = button.textContent;
  button.textContent = text;
  button.disabled = true;
}

function restoreButton(button, text) {
  button.textContent = text || button.dataset.originalText;
  button.disabled = false;
}

function generateSummaryTable(messengerText, jiraText, reportDate) {
  const jiraTasks = parseCsv(jiraText);
  const messengerItems = extractMessengerData(messengerText);
  
  const summaryRows = [];
  
  // 완료 업무
  const completedTasks = jiraTasks.filter((task) => task.status === "완료");
  completedTasks.forEach((task) => {
    summaryRows.push({
      category: "완료 업무",
      content: task.title || "제목 없음",
      owner: task.owner || "담당자 미지정",
      status: "완료",
      priority: normalizePriority(task.priority),
      nextAction: task.next_action || "-",
      isHighPriority: normalizePriority(task.priority) === "High",
    });
  });
  
  // 진행 중 업무
  const inProgressTasks = jiraTasks.filter((task) => ["진행 중", "모니터링"].includes(task.status));
  inProgressTasks.forEach((task) => {
    summaryRows.push({
      category: "진행 중 업무",
      content: task.title || "제목 없음",
      owner: task.owner || "담당자 미지정",
      status: normalizeStatus(task.status),
      priority: normalizePriority(task.priority),
      nextAction: task.next_action || "-",
      isHighPriority: normalizePriority(task.priority) === "High",
    });
  });
  
  // 지연/이슈 업무
  const blockedTasks = jiraTasks.filter((task) => task.status === "대기" || hasIssueKeyword(task));
  blockedTasks.forEach((task) => {
    summaryRows.push({
      category: "지연/이슈 업무",
      content: task.title || "제목 없음",
      owner: task.owner || "담당자 미지정",
      status: "대기",
      priority: normalizePriority(task.priority),
      nextAction: task.next_action || task.issue_summary || "추가 확인 필요",
      isHighPriority: normalizePriority(task.priority) === "High",
    });
  });
  
  // 내일 예정 업무
  const tomorrowTasks = jiraTasks.filter((task) => task.next_action && task.status !== "완료");
  tomorrowTasks.forEach((task) => {
    if (!summaryRows.some((row) => row.content === task.title)) {
      summaryRows.push({
        category: "내일 예정 업무",
        content: task.title || "제목 없음",
        owner: task.owner || "담당자 미지정",
        status: normalizeStatus(task.status),
        priority: normalizePriority(task.priority),
        nextAction: task.next_action || "-",
        isHighPriority: normalizePriority(task.priority) === "High",
      });
    }
  });
  
  // 메신저에서 추출한 이슈 항목
  messengerItems.forEach((item) => {
    summaryRows.push({
      category: "지원 필요 업무",
      content: item.content,
      owner: item.owner || "담당자 미지정",
      status: "추가 확인 필요",
      priority: "추가 확인 필요",
      nextAction: item.action || "확인 요청",
      isHighPriority: false,
    });
  });
  
  // 테이블에 행 추가
  const tbody = reportSummaryTable.querySelector("tbody");
  tbody.innerHTML = "";
  
  summaryRows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.isHighPriority) {
      tr.classList.add("high-priority");
    }
    
    tr.innerHTML = [
      `<td>${row.category}</td>`,
      `<td>${row.content}</td>`,
      `<td>${row.owner}</td>`,
      `<td>${row.status}</td>`,
      `<td>${row.priority}</td>`,
      `<td>${row.nextAction}</td>`,
    ].join("");
    
    tbody.appendChild(tr);
  });
}

function extractMessengerData(messengerText) {
  if (!messengerText) {
    return [];
  }
  
  const lines = messengerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  
  const items = [];
  const issueKeywords = ["실패", "Offline", "탐지", "경고", "차단", "오류", "이슈", "확인", "대기", "미적용"];
  
  lines.forEach((line) => {
    const hasIssue = issueKeywords.some((keyword) => line.includes(keyword));
    if (hasIssue) {
      const match = line.match(/(\d{2}:\d{2})\s+(.+?)\((.+?)\)/);
      if (match) {
        items.push({
          content: line.substring(match[0].length).trim() || "이슈 발생",
          owner: match[3],
          action: "확인 및 대응",
        });
      } else {
        items.push({
          content: line,
          owner: "담당자 미지정",
          action: "확인 요청",
        });
      }
    }
  });
  
  return items.slice(0, 5); // 최대 5개만
}

function normalizeStatus(status) {
  const statusMap = {
    "완료": "완료",
    "진행 중": "진행 중",
    "모니터링": "모니터링",
    "대기": "대기",
    "예정": "예정",
  };
  
  return statusMap[status] || "추가 확인 필요";
}

function normalizePriority(priority) {
  const priorityMap = {
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
    "높음": "High",
    "중간": "Medium",
    "낮음": "Low",
  };
  
  return priorityMap[priority] || "추가 확인 필요";
}

function extractSummaryTableAsText() {
  const rows = reportSummaryTable.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    return "";
  }
  
  const headers = ["구분", "주요 내용", "담당자", "상태", "우선순위", "다음 조치"];
  const lines = [
    "=".repeat(100),
    "업무 현황 요약표",
    "=".repeat(100),
    headers.join(" | "),
    "-".repeat(100),
  ];
  
  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    const rowData = Array.from(cells).map((cell) => cell.textContent.trim());
    lines.push(rowData.join(" | "));
  });
  
  lines.push("=".repeat(100));
  return lines.join("\n");
}

function extractSummaryTableAsMarkdown() {
  const rows = reportSummaryTable.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    return "";
  }
  
  const headers = ["구분", "주요 내용", "담당자", "상태", "우선순위", "다음 조치"];
  const lines = [
    "## 업무 현황 요약표",
    "",
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => " --- ").join("|")}|`,
  ];
  
  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    const rowData = Array.from(cells).map((cell) => {
      const text = cell.textContent.trim();
      return text.replace(/\|/g, "\\|");
    });
    lines.push(`| ${rowData.join(" | ")} |`);
  });
  
  lines.push("");
  return lines.join("\n");
}

function generateMarkdownReport() {
  const reportDate = reportDateInput.value || getTodayDateString();
  const bodyText = reportOutput.textContent.trim();
  
  if (!bodyText) {
    return "";
  }
  
  const summaryTable = extractSummaryTableAsMarkdown();
  
  const lines = [
    `# SecureX 일일 업무보고서`,
    "",
    `**작성일**: ${reportDate}`,
    `**생성 시각**: ${getCurrentTimeString()}`,
    "",
  ];
  
  if (summaryTable) {
    lines.push(summaryTable);
  }
  
  lines.push("---");
  lines.push("");
  
  const sections = bodyText.split(/\[/);
  for (let i = 1; i < sections.length; i++) {
    const sectionMatch = sections[i].match(/^([^\]]+)\]([\s\S]*?)(?=\[|$)/);
    if (sectionMatch) {
      const sectionTitle = sectionMatch[1];
      const sectionContent = sectionMatch[2].trim();
      
      lines.push(`## ${sectionTitle}`);
      lines.push("");
      lines.push(sectionContent);
      lines.push("");
    }
  }
  
  return lines.join("\n");
}

function downloadReport() {
  const reportDate = reportDateInput.value || getTodayDateString();
  const markdownReport = generateMarkdownReport();
  
  if (!markdownReport) {
    reportOutput.textContent = "⚠ 다운로드할 보고서가 없습니다.\n\n먼저 보고서를 생성해 주세요.";
    return;
  }
  
  try {
    const filename = `securex_daily_report_${reportDate}.md`;
    const element = document.createElement("a");
    element.setAttribute("href", `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownReport)}`);
    element.setAttribute("download", filename);
    element.style.display = "none";
    
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    setButtonLoading(downloadButton, "✓ 다운로드 완료");
    window.setTimeout(() => restoreButton(downloadButton, "MD 다운로드"), 1200);
  } catch (error) {
    reportOutput.textContent = "⚠ 파일 다운로드 중 오류가 발생했습니다.\n다시 시도해 주세요.";
  }
}

function getCurrentTimeString() {
  const now = new Date();
  return now.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function displayGeneratedTime() {
  generatedTime.textContent = `✓ 보고서 생성 시각: ${getCurrentTimeString()}`;
  generatedTime.style.display = "block";
}

let totalStudents = 23;
let columns = 3;
let roster: string[] = [];
let students: string[] = Array.from({ length: totalStudents }, () => '');
let fixedSeats: Record<number, string> = {};
let isTeacherView = true;

// Validation Rules
let requiredPairs: [string, string][] = [];
let bannedPairs: [string, string][] = [];
let separatedGroups: string[][] = [];
let frontRowStudents: string[] = [];

// Swap mode
let isSwapMode = false;
let swapFirstIndex: number | null = null;
let selectedFixedSeatIndex: number | null = null;

type SeatingSnapshot = {
  label: string;
  savedAt: string;
  totalStudents: number;
  columns: number;
  roster: string[];
  students: string[];
  fixedSeats: Record<number, string>;
  requiredPairs: [string, string][];
  bannedPairs: [string, string][];
  separatedGroups?: string[][];
  separatedStudents?: string[];
  frontRowStudents: string[];
};

type ValidationIssue = {
  message: string;
  seats?: number[];
  blocking?: boolean;
};

let historyStack: SeatingSnapshot[] = [];

// DOM Elements
const deskGridContainer = document.getElementById('desk-grid-container')!;
const inputTotal = document.getElementById('inputTotal') as HTMLInputElement;
const inputCols = document.getElementById('inputCols') as HTMLInputElement;
const body = document.body;
const viewLabel = document.getElementById('view-label')!;
const viewBtnText = document.getElementById('viewBtnText')!;
const fixedSeatModal = document.getElementById('fixedSeatModal')!;
const fixedSeatSelect = document.getElementById('fixedSeatSelect') as HTMLSelectElement;
const fixedSeatLabel = document.getElementById('fixedSeatLabel')!;
const validationResults = document.getElementById('validationResults')!;
const validationSummary = document.getElementById('validationSummary')!;
const historyMeta = document.getElementById('historyMeta')!;

function createEmptyLayout(size = totalStudents): string[] {
  return Array.from({ length: size }, () => '');
}

function parseNameList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name);
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.filter((name) => name))];
}

function normalizeSeparatedGroups(source: unknown): string[][] {
  if (!Array.isArray(source)) return [];
  if (source.every((group) => Array.isArray(group))) {
    return source
      .map((group) => uniqueNames(group.map((name: unknown) => String(name).trim())))
      .filter((group) => group.length > 0);
  }

  return [uniqueNames(source.map((name) => String(name).trim()))].filter((group) => group.length > 0);
}

function parseSeparatedGroups(text: string): string[][] {
  const groups: string[][] = [];
  const groupPattern = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = groupPattern.exec(text)) !== null) {
    const names = uniqueNames(parseNameList(match[1]));
    if (names.length > 0) groups.push(names);
  }

  if (groups.length > 0) return groups;

  const legacyNames = uniqueNames(parseNameList(text));
  return legacyNames.length > 0 ? [legacyNames] : [];
}

function formatSeparatedGroups(groups: string[][]): string {
  return groups.map((group) => `{${group.join(', ')}}`).join(', ');
}

function ensureLayoutSize() {
  if (students.length > totalStudents) {
    students = students.slice(0, totalStudents);
  }
  while (students.length < totalStudents) {
    students.push('');
  }

  for (const indexStr of Object.keys(fixedSeats)) {
    const index = Number(indexStr);
    if (index < 0 || index >= totalStudents) {
      delete fixedSeats[index];
    }
  }
}

function cleanFixedSeats() {
  const validNames = new Set(roster);
  const usedNames = new Set<string>();

  Object.entries(fixedSeats).forEach(([indexStr, name]) => {
    const index = Number(indexStr);
    if (index < 0 || index >= totalStudents || !validNames.has(name) || usedNames.has(name)) {
      delete fixedSeats[index];
      return;
    }
    usedNames.add(name);
    students[index] = name;
  });
}

function cloneFixedSeats(source: Record<number, string>): Record<number, string> {
  return Object.fromEntries(Object.entries(source).map(([index, name]) => [Number(index), name]));
}

function createSnapshot(label: string): SeatingSnapshot {
  return {
    label,
    savedAt: new Date().toISOString(),
    totalStudents,
    columns,
    roster: [...roster],
    students: [...students],
    fixedSeats: cloneFixedSeats(fixedSeats),
    requiredPairs: requiredPairs.map(([a, b]) => [a, b]),
    bannedPairs: bannedPairs.map(([a, b]) => [a, b]),
    separatedGroups: separatedGroups.map((group) => [...group]),
    frontRowStudents: [...frontRowStudents],
  };
}

function pushHistory(label: string) {
  ensureLayoutSize();
  historyStack.unshift(createSnapshot(label));
  historyStack = historyStack.slice(0, 20);
  updateHistoryMeta();
}

function applySnapshot(snapshot: SeatingSnapshot) {
  totalStudents = snapshot.totalStudents;
  columns = snapshot.columns;
  roster = [...snapshot.roster];
  students = [...snapshot.students];
  fixedSeats = cloneFixedSeats(snapshot.fixedSeats);
  requiredPairs = snapshot.requiredPairs.map(([a, b]) => [a, b]);
  bannedPairs = snapshot.bannedPairs.map(([a, b]) => [a, b]);
  separatedGroups = normalizeSeparatedGroups(snapshot.separatedGroups ?? snapshot.separatedStudents ?? []);
  frontRowStudents = [...snapshot.frontRowStudents];
  inputTotal.value = totalStudents.toString();
  inputCols.value = columns.toString();
  ensureLayoutSize();
  cleanFixedSeats();
}

function updateHistoryMeta() {
  const undoButton = document.getElementById('btnUndo') as HTMLButtonElement | null;
  if (undoButton) undoButton.disabled = historyStack.length === 0;
  if (!historyMeta) return;

  if (historyStack.length === 0) {
    historyMeta.textContent = '저장된 되돌리기 기록 없음';
    return;
  }

  const latest = historyStack[0];
  const time = new Date(latest.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  historyMeta.textContent = `${latest.label} (${time})`;
}

function saveState() {
  ensureLayoutSize();
  cleanFixedSeats();
  localStorage.setItem(
    'seating_state',
    JSON.stringify({
      totalStudents,
      columns,
      roster,
      students,
      fixedSeats,
      requiredPairs,
      bannedPairs,
      separatedGroups,
      frontRowStudents,
      historyStack,
    })
  );
  updateHistoryMeta();
}

function loadState(): boolean {
  const raw = localStorage.getItem('seating_state');
  if (!raw) return false;

  try {
    const s = JSON.parse(raw);
    if (s.totalStudents) totalStudents = s.totalStudents;
    if (s.columns) columns = s.columns;
    if (Array.isArray(s.roster)) {
      roster = s.roster;
    } else if (Array.isArray(s.students)) {
      roster = s.students.filter((name: string) => name?.trim());
    }
    if (Array.isArray(s.students)) students = s.students;
    if (s.fixedSeats) fixedSeats = s.fixedSeats;
    if (s.requiredPairs) requiredPairs = s.requiredPairs;
    if (s.bannedPairs) bannedPairs = s.bannedPairs;
    separatedGroups = normalizeSeparatedGroups(s.separatedGroups ?? s.separatedStudents ?? []);
    if (s.frontRowStudents) frontRowStudents = s.frontRowStudents;
    if (Array.isArray(s.historyStack)) historyStack = s.historyStack.slice(0, 20);
    ensureLayoutSize();
    cleanFixedSeats();
    updateHistoryMeta();
    return true;
  } catch {
    return false;
  }
}

function getFixedNames(exceptSeatIndex?: number): string[] {
  return Object.entries(fixedSeats)
    .filter(([index]) => Number(index) !== exceptSeatIndex)
    .map(([, name]) => name);
}

function removeNameFromOtherSeats(name: string, exceptSeatIndex: number) {
  Object.entries(fixedSeats).forEach(([indexStr, fixedName]) => {
    const index = Number(indexStr);
    if (index !== exceptSeatIndex && fixedName === name) {
      delete fixedSeats[index];
    }
  });

  students = students.map((studentName, index) =>
    index !== exceptSeatIndex && studentName === name ? '' : studentName
  );
}

function setFixedSeat(seatIndex: number, name: string) {
  ensureLayoutSize();

  const previousName = fixedSeats[seatIndex];
  if (!name) {
    delete fixedSeats[seatIndex];
    if (previousName && students[seatIndex] === previousName) {
      students[seatIndex] = '';
    }
    return;
  }

  removeNameFromOtherSeats(name, seatIndex);
  fixedSeats[seatIndex] = name;
  students[seatIndex] = name;
}

function openFixedSeatModal(seatIndex: number) {
  if (roster.length === 0) {
    alert('먼저 명단을 입력해주세요.');
    return;
  }

  selectedFixedSeatIndex = seatIndex;
  fixedSeatLabel.textContent = `${seatIndex + 1}번 자리에 고정할 학생`;
  fixedSeatSelect.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '빈자리로 두기';
  fixedSeatSelect.appendChild(emptyOption);

  const unavailableNames = new Set(getFixedNames(seatIndex));
  roster.forEach((name) => {
    if (unavailableNames.has(name)) return;
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    fixedSeatSelect.appendChild(option);
  });

  fixedSeatSelect.value = fixedSeats[seatIndex] || '';
  fixedSeatModal.classList.add('active');
}

function closeFixedSeatModal() {
  selectedFixedSeatIndex = null;
  fixedSeatModal.classList.remove('active');
}

function initGrid() {
  ensureLayoutSize();
  deskGridContainer.innerHTML = '';
  const totalRows = Math.ceil(totalStudents / 2);
  const rowsPerCluster = Math.ceil(totalRows / columns);

  const clusterContainer = document.createElement('div');
  clusterContainer.className = 'flex gap-6 desk-cluster';

  for (let c = 0; c < columns; c++) {
    const colDiv = document.createElement('div');
    colDiv.className = 'flex flex-col gap-2 desk-col';

    for (let r = 0; r < rowsPerCluster; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'flex gap-2 seat-row';

      for (let pair = 0; pair < 2; pair++) {
        const deskIndex = r * (columns * 2) + c * 2 + pair;
        if (deskIndex >= totalStudents) continue;

        const desk = document.createElement('div');
        desk.className = 'desk rounded-md shadow-sm';
        desk.dataset.index = deskIndex.toString();

        const nameSpan = document.createElement('span');
        nameSpan.className = 'student-name';
        nameSpan.textContent = students[deskIndex] || '';

        const numSpan = document.createElement('span');
        numSpan.className = 'desk-number';
        numSpan.textContent = (deskIndex + 1).toString();

        if (fixedSeats[deskIndex]) {
          desk.classList.add('seat-fixed');
          nameSpan.textContent = fixedSeats[deskIndex];
        }

        desk.appendChild(numSpan);
        desk.appendChild(nameSpan);

        desk.addEventListener('click', () => {
          const idx = parseInt(desk.dataset.index!, 10);
          if (isSwapMode) {
            if (swapFirstIndex === null) {
              swapFirstIndex = idx;
              desk.classList.add('selected');
              return;
            }
            if (swapFirstIndex === idx) {
              desk.classList.remove('selected');
              swapFirstIndex = null;
              return;
            }

            pushHistory('자리 바꾸기 전');
            const temp = students[swapFirstIndex];
            students[swapFirstIndex] = students[idx];
            students[idx] = temp;

            const firstFixed = fixedSeats[swapFirstIndex];
            const secondFixed = fixedSeats[idx];
            delete fixedSeats[swapFirstIndex];
            delete fixedSeats[idx];
            if (secondFixed) fixedSeats[swapFirstIndex] = secondFixed;
            if (firstFixed) fixedSeats[idx] = firstFixed;

            swapFirstIndex = null;
            initGrid();
            saveState();
            return;
          }

          openFixedSeatModal(idx);
        });

        rowDiv.appendChild(desk);
      }
      if (rowDiv.children.length > 0) {
        colDiv.appendChild(rowDiv);
      }
    }
    clusterContainer.appendChild(colDiv);
  }
  deskGridContainer.appendChild(clusterContainer);
}

document.getElementById('btnToggleView')?.addEventListener('click', () => {
  isTeacherView = !isTeacherView;
  if (isTeacherView) {
    body.classList.remove('student-view');
    body.classList.add('teacher-view');
    viewLabel.textContent = '현재: 교사 시점 (운동장: 우측 / 교탁: 아래)';
    viewBtnText.textContent = '학생 시점으로 보기';
  } else {
    body.classList.remove('teacher-view');
    body.classList.add('student-view');
    viewLabel.textContent = '현재: 학생 시점 (운동장: 좌측 / 교탁: 위)';
    viewBtnText.textContent = '교사 시점으로 보기';
  }
});

const swapModeBtn = document.getElementById('swapModeBtn')!;
const swapStatus = document.getElementById('swapStatus')!;
swapModeBtn.addEventListener('click', () => {
  isSwapMode = !isSwapMode;
  swapFirstIndex = null;
  if (isSwapMode) {
    swapStatus.textContent = 'ON';
    swapStatus.className = 'text-green-500 font-bold';
  } else {
    swapStatus.textContent = 'OFF';
    swapStatus.className = 'text-red-500 font-bold';
    document.querySelectorAll('.desk.selected').forEach((el) => el.classList.remove('selected'));
  }
});

document.getElementById('btnCopy')?.addEventListener('click', () => {
  const nameList = roster.join(', ');
  navigator.clipboard
    .writeText(nameList)
    .then(() => {
      alert('명단이 클립보드에 복사되었습니다.');
    })
    .catch(() => {
      prompt('명단을 복사하세요:', nameList);
    });
});

inputTotal.addEventListener('change', (e) => {
  const newTotal = parseInt((e.target as HTMLInputElement).value, 10);
  if (!Number.isFinite(newTotal) || newTotal < 1) return;
  pushHistory('전체 인원 변경 전');
  totalStudents = newTotal;
  ensureLayoutSize();
  cleanFixedSeats();
  initGrid();
  saveState();
});

inputCols.addEventListener('change', (e) => {
  const newColumns = parseInt((e.target as HTMLInputElement).value, 10);
  if (!Number.isFinite(newColumns) || newColumns < 1) return;
  pushHistory('분단 개수 변경 전');
  columns = newColumns;
  initGrid();
  saveState();
});

const bulkModal = document.getElementById('bulkInputModal')!;
document.getElementById('btnBulkInput')?.addEventListener('click', () => {
  bulkModal.classList.add('active');
  (document.getElementById('bulkNames') as HTMLTextAreaElement).value = roster.join(', ');
});
document.getElementById('btnCancelBulk')?.addEventListener('click', () => bulkModal.classList.remove('active'));
document.getElementById('btnApplyBulk')?.addEventListener('click', () => {
  const text = (document.getElementById('bulkNames') as HTMLTextAreaElement).value;
  const names = parseNameList(text);
  if (names.length > 0) {
    pushHistory('명단 변경 전');
    roster = names;
    totalStudents = names.length;
    inputTotal.value = totalStudents.toString();
    students = createEmptyLayout(totalStudents);
    fixedSeats = {};
    initGrid();
    saveState();
  }
  bulkModal.classList.remove('active');
});

document.getElementById('btnCancelFixed')?.addEventListener('click', closeFixedSeatModal);
document.getElementById('btnClearFixed')?.addEventListener('click', () => {
  if (selectedFixedSeatIndex !== null) {
    pushHistory('고정 해제 전');
    setFixedSeat(selectedFixedSeatIndex, '');
    initGrid();
    saveState();
  }
  closeFixedSeatModal();
});
document.getElementById('btnSaveFixed')?.addEventListener('click', () => {
  if (selectedFixedSeatIndex !== null) {
    pushHistory('고정 좌석 변경 전');
    setFixedSeat(selectedFixedSeatIndex, fixedSeatSelect.value);
    initGrid();
    saveState();
  }
  closeFixedSeatModal();
});

document.getElementById('btnUndo')?.addEventListener('click', () => {
  const snapshot = historyStack.shift();
  if (!snapshot) {
    updateHistoryMeta();
    return;
  }

  applySnapshot(snapshot);
  initGrid();
  saveState();
  renderValidationIssues('되돌리기 완료', [], `${snapshot.label} 상태로 되돌렸습니다.`);
});

document.getElementById('btnResetLayout')?.addEventListener('click', () => {
  const hasLayout = students.some((name) => name) || Object.keys(fixedSeats).length > 0;
  if (!hasLayout) {
    renderValidationIssues('자리 초기화 완료', [], '이미 모든 자리가 비어 있습니다.');
    return;
  }

  const confirmed = window.confirm('모든 자리와 고정석을 빈자리로 초기화할까요? 명단과 검증 설정은 유지됩니다.');
  if (!confirmed) return;

  pushHistory('자리 초기화 전');
  students = createEmptyLayout(totalStudents);
  fixedSeats = {};
  initGrid();
  saveState();
  renderValidationIssues('자리 초기화 완료', [], '모든 자리를 빈자리로 초기화했습니다.');
});

const usageModal = document.getElementById('usageModal')!;
const closeUsageModal = () => usageModal.classList.remove('active');
document.getElementById('btnUsageModal')?.addEventListener('click', () => usageModal.classList.add('active'));
document.getElementById('btnCloseUsage')?.addEventListener('click', closeUsageModal);
document.getElementById('btnCloseUsageTop')?.addEventListener('click', closeUsageModal);

const valModal = document.getElementById('validationModal')!;
document.getElementById('btnValidationModal')?.addEventListener('click', () => valModal.classList.add('active'));
document.getElementById('btnCancelValidation')?.addEventListener('click', () => valModal.classList.remove('active'));
document.getElementById('btnSaveValidation')?.addEventListener('click', () => {
  pushHistory('검증 설정 변경 전');
  const reqPairs = (document.getElementById('valRequiredPairs') as HTMLInputElement).value;
  requiredPairs = reqPairs
    .split(',')
    .map((s) => s.split('-').map((n) => n.trim()) as [string, string])
    .filter((p) => p.length === 2 && p[0] && p[1]);

  const valPairs = (document.getElementById('valBannedPairs') as HTMLInputElement).value;
  bannedPairs = valPairs
    .split(',')
    .map((s) => s.split('-').map((n) => n.trim()) as [string, string])
    .filter((p) => p.length === 2 && p[0] && p[1]);

  separatedGroups = parseSeparatedGroups((document.getElementById('valSeparated') as HTMLInputElement).value);
  frontRowStudents = (document.getElementById('valFrontRow') as HTMLInputElement).value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);

  valModal.classList.remove('active');
  saveState();
  alert('검증 설정이 저장되었습니다.');
});

function getSeatPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < totalStudents; i += 2) {
    pairs.push([i, i + 1]);
  }
  return pairs;
}

function getSeatMateIndex(seatIndex: number): number | null {
  const mate = seatIndex % 2 === 0 ? seatIndex + 1 : seatIndex - 1;
  return mate >= 0 && mate < totalStudents ? mate : null;
}

function getFrontRowSeats(): number[] {
  const totalRows = Math.ceil(totalStudents / 2);
  const rowsPerCluster = Math.ceil(totalRows / columns);
  const frontSeats: number[] = [];
  for (let r = 0; r < rowsPerCluster; r++) {
    for (let c = 0; c < columns; c++) {
      for (let p = 0; p < 2; p++) {
        const idx = r * (columns * 2) + c * 2 + p;
        if (idx < totalStudents && (r === 0 || r === 1)) {
          frontSeats.push(idx);
        }
      }
    }
  }
  return frontSeats;
}

function getCoords(seatIdx: number): { x: number; y: number } | null {
  const colsTotal = columns * 2;
  const r = Math.floor(seatIdx / colsTotal);
  const remainder = seatIdx % colsTotal;
  const c = Math.floor(remainder / 2);
  const p = remainder % 2;
  return { x: c * 2 + p, y: r };
}

function getFillableSeatIndices(limit = Infinity): number[] {
  const indices: number[] = [];
  for (let i = 0; i < totalStudents && indices.length < limit; i++) {
    if (!fixedSeats[i]) indices.push(i);
  }
  return indices;
}

function removeFromRemaining(remaining: string[], name: string) {
  const index = remaining.indexOf(name);
  if (index !== -1) remaining.splice(index, 1);
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function rearrangeForConstraints(winners: string[], fixed: Record<number, string>): string[] {
  const layout: (string | null)[] = new Array(totalStudents).fill(null);
  Object.entries(fixed).forEach(([indexStr, name]) => {
    const index = Number(indexStr);
    if (index >= 0 && index < totalStudents) layout[index] = name;
  });

  const fillableIndices = getFillableSeatIndices(winners.length);
  const fillableSet = new Set(fillableIndices);
  const assigned = new Set<number>();
  const remaining = [...winners];
  const seatPairs = getSeatPairs();
  const frontSeats = getFrontRowSeats();
  const frontSeatSet = new Set(frontSeats);

  const assignToSeat = (seatIndex: number, name: string) => {
    layout[seatIndex] = name;
    assigned.add(seatIndex);
    removeFromRemaining(remaining, name);
  };

  const canAssign = (seatIndex: number) => fillableSet.has(seatIndex) && !assigned.has(seatIndex) && !layout[seatIndex];

  for (const [s1, s2] of requiredPairs) {
    const placedIndex1 = layout.indexOf(s1);
    const placedIndex2 = layout.indexOf(s2);
    const hasS1 = remaining.includes(s1);
    const hasS2 = remaining.includes(s2);

    if (placedIndex1 !== -1 && placedIndex2 !== -1) continue;

    if (placedIndex1 !== -1 && hasS2) {
      const mate = getSeatMateIndex(placedIndex1);
      if (mate !== null && canAssign(mate)) assignToSeat(mate, s2);
      continue;
    }

    if (placedIndex2 !== -1 && hasS1) {
      const mate = getSeatMateIndex(placedIndex2);
      if (mate !== null && canAssign(mate)) assignToSeat(mate, s1);
      continue;
    }

    if (!hasS1 || !hasS2) continue;

    const candidatePairs = seatPairs.filter(([pairA, pairB]) => canAssign(pairA) && canAssign(pairB));
    const needsFrontPair = frontRowStudents.includes(s1) || frontRowStudents.includes(s2);
    const preferredPairs = needsFrontPair
      ? candidatePairs.filter(([pairA, pairB]) => frontSeatSet.has(pairA) && frontSeatSet.has(pairB))
      : candidatePairs;
    const selectedPair = shuffleItems(preferredPairs.length > 0 ? preferredPairs : candidatePairs)[0];
    if (selectedPair) {
      const [pairA, pairB] = Math.random() < 0.5 ? selectedPair : [selectedPair[1], selectedPair[0]];
      assignToSeat(pairA, s1);
      assignToSeat(pairB, s2);
    }
  }

  for (const name of frontRowStudents) {
    if (layout.includes(name)) continue;
    if (!remaining.includes(name)) continue;

    for (const seat of frontSeats) {
      if (canAssign(seat)) {
        assignToSeat(seat, name);
        break;
      }
    }
  }

  const unassigned = fillableIndices.filter((index) => !assigned.has(index) && !layout[index]);
  for (const seatIndex of unassigned) {
    const name = remaining[0];
    if (!name) break;
    assignToSeat(seatIndex, name);
  }

  for (const [s1, s2] of bannedPairs) {
    for (const [pairA, pairB] of seatPairs) {
      const nameA = layout[pairA];
      const nameB = layout[pairB];
      if (!nameA || !nameB) continue;
      if (!((nameA === s1 && nameB === s2) || (nameA === s2 && nameB === s1))) continue;

      const swapTarget = fixed[pairB] ? pairA : pairB;
      let swapped = false;
      for (const candidate of fillableIndices) {
        if (candidate === pairA || candidate === pairB || fixed[candidate]) continue;
        const candidateName = layout[candidate];
        if (!candidateName) continue;
        const isRequiredName = requiredPairs.some(([r1, r2]) => candidateName === r1 || candidateName === r2);
        if (isRequiredName) continue;

        layout[candidate] = layout[swapTarget];
        layout[swapTarget] = candidateName;
        swapped = true;
        break;
      }
      if (!swapped) console.warn(`금지 짝꿍 해소 실패: ${s1}-${s2}`);
    }
  }

  for (const separatedGroup of separatedGroups) {
    const sepNames = separatedGroup.filter((name) => layout.includes(name));
    for (let i = 0; i < sepNames.length; i++) {
      for (let j = i + 1; j < sepNames.length; j++) {
        const idx1 = layout.indexOf(sepNames[i]);
        const idx2 = layout.indexOf(sepNames[j]);
        if (idx1 === -1 || idx2 === -1 || fixed[idx2]) continue;

        const pos1 = getCoords(idx1);
        const pos2 = getCoords(idx2);
        if (!pos1 || !pos2) continue;

        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        if (dx > 1 || dy > 1) continue;

        for (const candidate of fillableIndices) {
          if (candidate === idx1 || candidate === idx2 || fixed[candidate]) continue;
          const candidateName = layout[candidate];
          if (!candidateName || sepNames.includes(candidateName)) continue;

          const isRequiredName = requiredPairs.some(([r1, r2]) => candidateName === r1 || candidateName === r2);
          if (isRequiredName) continue;

          const candidatePos = getCoords(candidate);
          if (!candidatePos) continue;

          const newDx = Math.abs(candidatePos.x - pos1.x);
          const newDy = Math.abs(candidatePos.y - pos1.y);
          if (newDx > 1 || newDy > 1) {
            layout[candidate] = layout[idx2];
            layout[idx2] = candidateName;
            break;
          }
        }
      }
    }
  }

  return fillableIndices.map((index) => layout[index]).filter((name): name is string => !!name);
}

function seatLabel(index: number): string {
  return `${index + 1}번`;
}

function areSeatmates(a: number, b: number): boolean {
  return getSeatPairs().some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function areAdjacent(a: number, b: number): boolean {
  const posA = getCoords(a);
  const posB = getCoords(b);
  if (!posA || !posB) return false;
  return Math.abs(posA.x - posB.x) <= 1 && Math.abs(posA.y - posB.y) <= 1;
}

function clearViolationMarks() {
  document.querySelectorAll('.desk.violation').forEach((desk) => desk.classList.remove('violation'));
}

function markViolationSeats(issues: ValidationIssue[]) {
  clearViolationMarks();
  for (const issue of issues) {
    issue.seats?.forEach((seat) => {
      document.querySelector(`.desk[data-index="${seat}"]`)?.classList.add('violation');
    });
  }
}

function renderValidationIssues(title: string, issues: ValidationIssue[], successMessage: string) {
  markViolationSeats(issues);
  validationResults.classList.add('active');
  validationResults.classList.toggle('success', issues.length === 0);
  validationResults.innerHTML = '';

  if (issues.length === 0) {
    const strong = document.createElement('strong');
    strong.textContent = successMessage;
    validationResults.appendChild(strong);
    validationSummary.textContent = successMessage;
    return;
  }

  const strong = document.createElement('strong');
  strong.textContent = title;
  const list = document.createElement('ul');
  list.className = 'mt-2';
  issues.forEach((issue) => {
    const item = document.createElement('li');
    item.textContent = issue.message;
    list.appendChild(item);
  });
  validationResults.append(strong, list);
  validationSummary.textContent = `${issues.length}개 항목 확인 필요`;
}

function getRuleNames(): string[] {
  return [...requiredPairs.flat(), ...bannedPairs.flat(), ...separatedGroups.flat(), ...frontRowStudents].filter(
    (name) => name
  );
}

function getConstraintConflicts(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rosterSet = new Set(roster);
  const frontSeats = new Set(getFrontRowSeats());
  const fixedEntries = Object.entries(fixedSeats).map(([index, name]) => ({ index: Number(index), name }));

  if (roster.length > totalStudents) {
    issues.push({
      message: `명단 인원(${roster.length}명)이 좌석 수(${totalStudents}개)보다 많습니다.`,
      blocking: true,
    });
  }

  [...new Set(getRuleNames().filter((name) => !rosterSet.has(name)))].forEach((name) => {
    issues.push({ message: `"${name}"은/는 명단에 없어 검증 조건을 적용할 수 없습니다.`, blocking: true });
  });

  fixedEntries.forEach(({ index, name }) => {
    if (!rosterSet.has(name)) {
      issues.push({
        message: `${seatLabel(index)} 고정 학생 "${name}"은/는 명단에 없습니다.`,
        seats: [index],
        blocking: true,
      });
    }
  });

  const requiredKeySet = new Set(requiredPairs.map(([a, b]) => [a, b].sort().join('::')));
  bannedPairs.forEach(([a, b]) => {
    if (requiredKeySet.has([a, b].sort().join('::'))) {
      issues.push({ message: `${a}-${b}가 필수 짝꿍이면서 동시에 금지 짝꿍입니다.`, blocking: true });
    }
  });

  const requiredPartnerMap = new Map<string, string>();
  requiredPairs.forEach(([a, b]) => {
    const existingA = requiredPartnerMap.get(a);
    const existingB = requiredPartnerMap.get(b);
    if (existingA && existingA !== b)
      issues.push({ message: `${a}에게 필수 짝꿍이 2명 이상 지정되어 있습니다.`, blocking: true });
    if (existingB && existingB !== a)
      issues.push({ message: `${b}에게 필수 짝꿍이 2명 이상 지정되어 있습니다.`, blocking: true });
    requiredPartnerMap.set(a, b);
    requiredPartnerMap.set(b, a);
  });

  frontRowStudents.forEach((name) => {
    const fixedIndex = fixedEntries.find((entry) => entry.name === name)?.index;
    if (fixedIndex !== undefined && !frontSeats.has(fixedIndex)) {
      issues.push({
        message: `${name}은/는 필수 1,2열 대상이지만 ${seatLabel(fixedIndex)}에 고정되어 있습니다.`,
        seats: [fixedIndex],
        blocking: true,
      });
    }
  });

  const remainingFrontStudents = frontRowStudents.filter(
    (name) => rosterSet.has(name) && !fixedEntries.some((entry) => entry.name === name)
  );
  const availableFrontSeatCount = [...frontSeats].filter((seat) => !fixedSeats[seat]).length;
  if (remainingFrontStudents.length > availableFrontSeatCount) {
    issues.push({
      message: `필수 1,2열 대상 ${remainingFrontStudents.length}명을 배치하기에 빈 1,2열 좌석이 ${availableFrontSeatCount}개뿐입니다.`,
      blocking: true,
    });
  }

  requiredPairs.forEach(([a, b]) => {
    const fixedA = fixedEntries.find((entry) => entry.name === a)?.index;
    const fixedB = fixedEntries.find((entry) => entry.name === b)?.index;

    if (fixedA !== undefined && fixedB !== undefined && !areSeatmates(fixedA, fixedB)) {
      issues.push({
        message: `${a}-${b}는 필수 짝꿍이지만 각각 ${seatLabel(fixedA)}, ${seatLabel(fixedB)}에 고정되어 있습니다.`,
        seats: [fixedA, fixedB],
        blocking: true,
      });
      return;
    }

    const fixedIndex = fixedA ?? fixedB;
    const movingName = fixedA !== undefined ? b : a;
    if (fixedIndex === undefined || !rosterSet.has(movingName)) return;

    const mate = getSeatMateIndex(fixedIndex);
    if (mate === null) {
      issues.push({
        message: `${seatLabel(fixedIndex)}에는 짝 좌석이 없어 필수 짝꿍 ${a}-${b}를 만들 수 없습니다.`,
        seats: [fixedIndex],
        blocking: true,
      });
      return;
    }

    const fixedMateName = fixedSeats[mate];
    if (fixedMateName && fixedMateName !== movingName) {
      issues.push({
        message: `${a}-${b} 필수 짝꿍을 만들 자리(${seatLabel(mate)})가 이미 ${fixedMateName}에게 고정되어 있습니다.`,
        seats: [fixedIndex, mate],
        blocking: true,
      });
    }
  });

  bannedPairs.forEach(([a, b]) => {
    const fixedA = fixedEntries.find((entry) => entry.name === a)?.index;
    const fixedB = fixedEntries.find((entry) => entry.name === b)?.index;
    if (fixedA !== undefined && fixedB !== undefined && areSeatmates(fixedA, fixedB)) {
      issues.push({
        message: `${a}-${b}는 금지 짝꿍이지만 현재 고정 좌석이 짝입니다.`,
        seats: [fixedA, fixedB],
        blocking: true,
      });
    }
  });

  for (const separatedGroup of separatedGroups) {
    const fixedSeparated = separatedGroup
      .map((name) => ({ name, index: fixedEntries.find((entry) => entry.name === name)?.index }))
      .filter((entry): entry is { name: string; index: number } => entry.index !== undefined);
    for (let i = 0; i < fixedSeparated.length; i++) {
      for (let j = i + 1; j < fixedSeparated.length; j++) {
        if (areAdjacent(fixedSeparated[i].index, fixedSeparated[j].index)) {
          issues.push({
            message: `${fixedSeparated[i].name}와 ${fixedSeparated[j].name}는 같은 인접 금지 그룹인데 고정 좌석이 인접합니다.`,
            seats: [fixedSeparated[i].index, fixedSeparated[j].index],
            blocking: true,
          });
        }
      }
    }
  }

  return issues;
}

function getValidationIssues(currentStudents: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const frontRowSeats = getFrontRowSeats();

  for (const [indexStr, name] of Object.entries(fixedSeats)) {
    const index = parseInt(indexStr, 10);
    if (currentStudents[index] !== name) {
      issues.push({ message: `${seatLabel(index)} 고정 학생 ${name}이/가 현재 배치에 없습니다.`, seats: [index] });
    }
  }

  roster.forEach((name) => {
    if (!currentStudents.includes(name)) issues.push({ message: `${name}이/가 아직 배치되지 않았습니다.` });
  });

  for (const name of frontRowStudents) {
    const sIdx = currentStudents.indexOf(name);
    if (sIdx !== -1 && !frontRowSeats.includes(sIdx)) {
      issues.push({ message: `${name}은/는 필수 1,2열 대상이지만 ${seatLabel(sIdx)}에 있습니다.`, seats: [sIdx] });
    }
  }

  for (const separatedGroup of separatedGroups) {
    const sepIndices = separatedGroup
      .map((s) => ({ name: s, index: currentStudents.indexOf(s) }))
      .filter((i) => i.index !== -1);
    for (let i = 0; i < sepIndices.length; i++) {
      for (let j = i + 1; j < sepIndices.length; j++) {
        if (areAdjacent(sepIndices[i].index, sepIndices[j].index)) {
          issues.push({
            message: `${sepIndices[i].name}와 ${sepIndices[j].name}가 같은 인접 금지 그룹 조건을 어겼습니다.`,
            seats: [sepIndices[i].index, sepIndices[j].index],
          });
        }
      }
    }
  }

  for (const [s1, s2] of requiredPairs) {
    const i1 = currentStudents.indexOf(s1);
    const i2 = currentStudents.indexOf(s2);
    if (i1 !== -1 && i2 !== -1 && !areSeatmates(i1, i2)) {
      issues.push({ message: `${s1}-${s2}는 필수 짝꿍이지만 짝으로 배치되지 않았습니다.`, seats: [i1, i2] });
    }
  }

  for (const [s1, s2] of bannedPairs) {
    const i1 = currentStudents.indexOf(s1);
    const i2 = currentStudents.indexOf(s2);
    if (i1 !== -1 && i2 !== -1 && areSeatmates(i1, i2)) {
      issues.push({ message: `${s1}-${s2}는 금지 짝꿍인데 짝으로 배치되었습니다.`, seats: [i1, i2] });
    }
  }

  return issues;
}

document.getElementById('btnValidate')?.addEventListener('click', () => {
  const issues = [...getConstraintConflicts(), ...getValidationIssues(students)];
  renderValidationIssues('검증 실패 이유', issues, '검증 조건을 모두 만족합니다.');
});

document.getElementById('btnPrint')?.addEventListener('click', () => {
  window.print();
});

function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const metrics = ctx.measureText(text);
  if (metrics.width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped}…`, x, y);
}

function saveLayoutAsPng() {
  const exportTeacherView = body.classList.contains('teacher-view');
  const seatW = 92;
  const seatH = 66;
  const seatGap = 8;
  const clusterGap = 30;
  const sideW = 64;
  const margin = 42;
  const titleH = 48;
  const podiumGap = 24;
  const podiumH = 58;
  const totalRows = Math.ceil(totalStudents / 2);
  const rowsPerCluster = Math.ceil(totalRows / columns);
  const clusterW = seatW * 2 + seatGap;
  const gridW = columns * clusterW + Math.max(0, columns - 1) * clusterGap;
  const gridH = rowsPerCluster * seatH + Math.max(0, rowsPerCluster - 1) * seatGap;
  const sideH = gridH + podiumGap + podiumH;
  const canvasW = margin * 2 + sideW * 2 + seatGap * 4 + gridW;
  const canvasH = margin * 2 + titleH + sideH;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW * 2;
  canvas.height = canvasH * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111827';
  ctx.font = '900 26px Pretendard, sans-serif';
  ctx.fillText('자리배치표', canvasW / 2, margin);

  const gridLeft = margin + sideW + seatGap * 2;
  const layoutTop = margin + titleH;
  const gridTop = exportTeacherView ? layoutTop : layoutTop + podiumH + podiumGap;
  const leftSideX = margin;
  const rightSideX = gridLeft + gridW + seatGap * 2;

  const drawSide = (x: number, label: string) => {
    ctx.fillStyle = '#1e5f85';
    ctx.fillRect(x, layoutTop, sideW, sideH);
    ctx.save();
    ctx.translate(x + sideW / 2, layoutTop + sideH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Pretendard, sans-serif';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };

  drawSide(leftSideX, exportTeacherView ? '복도' : '운동장');
  drawSide(rightSideX, exportTeacherView ? '운동장' : '복도');

  for (let c = 0; c < columns; c++) {
    const visualC = exportTeacherView ? columns - 1 - c : c;
    const clusterX = gridLeft + visualC * (clusterW + clusterGap);
    for (let r = 0; r < rowsPerCluster; r++) {
      const visualR = exportTeacherView ? rowsPerCluster - 1 - r : r;
      for (let p = 0; p < 2; p++) {
        const seatIndex = r * (columns * 2) + c * 2 + p;
        if (seatIndex >= totalStudents) continue;
        const visualP = exportTeacherView ? 1 - p : p;
        const x = clusterX + visualP * (seatW + seatGap);
        const y = gridTop + visualR * (seatH + seatGap);
        const name = students[seatIndex] || '';

        ctx.fillStyle = fixedSeats[seatIndex] ? '#fef08a' : '#ffffff';
        ctx.strokeStyle = fixedSeats[seatIndex] ? '#ca8a04' : '#111827';
        ctx.lineWidth = fixedSeats[seatIndex] ? 3 : 2;
        ctx.fillRect(x, y, seatW, seatH);
        ctx.strokeRect(x, y, seatW, seatH);

        if (name) {
          ctx.fillStyle = '#111827';
          ctx.font = '900 18px Pretendard, sans-serif';
          drawCenteredText(ctx, name, x + seatW / 2, y + seatH / 2, seatW - 10);
        }
      }
    }
  }

  const podiumW = 230;
  const podiumX = gridLeft + gridW / 2 - podiumW / 2;
  const podiumY = exportTeacherView ? gridTop + gridH + podiumGap : layoutTop;
  ctx.fillStyle = '#fbc4ab';
  ctx.strokeStyle = '#e5a88a';
  ctx.lineWidth = 4;
  ctx.fillRect(podiumX, podiumY, podiumW, podiumH);
  ctx.strokeRect(podiumX, podiumY, podiumW, podiumH);
  ctx.fillStyle = '#9c4d28';
  ctx.font = '900 24px Pretendard, sans-serif';
  ctx.fillText('교 탁', podiumX + podiumW / 2, podiumY + podiumH / 2);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `seating-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
}

document.getElementById('btnSavePng')?.addEventListener('click', saveLayoutAsPng);

document.getElementById('btnRunRoulette')?.addEventListener('click', () => {
  cleanFixedSeats();

  if (roster.length === 0) {
    alert('먼저 명단을 입력해주세요.');
    return;
  }

  const conflicts = getConstraintConflicts();
  if (conflicts.some((issue) => issue.blocking)) {
    renderValidationIssues('룰렛 전 검증 조건 충돌', conflicts, '룰렛을 돌릴 수 있습니다.');
    alert('검증 조건에 충돌이 있어 룰렛을 시작할 수 없습니다. 화면의 실패 이유를 확인해주세요.');
    return;
  }

  const availableSeats = getFillableSeatIndices();
  const fixedNames = Object.values(fixedSeats);
  const namesToRoll = roster.filter((name) => !fixedNames.includes(name));

  if (roster.length > totalStudents) {
    alert('좌석 수가 명단 인원보다 적습니다. 전체 인원을 늘려주세요.');
    return;
  }

  if (namesToRoll.length > availableSeats.length) {
    alert('고정 좌석을 제외한 빈자리가 부족합니다.');
    return;
  }

  if (namesToRoll.length === 0) {
    pushHistory('전체 고정 배치 전');
    students = createEmptyLayout(totalStudents);
    Object.entries(fixedSeats).forEach(([indexStr, name]) => {
      students[Number(indexStr)] = name;
    });
    saveState();
    initGrid();
    alert('모든 학생이 고정되어 룰렛을 돌릴 학생이 없습니다.');
    return;
  }

  if (namesToRoll.length === 1) {
    pushHistory('남은 1명 자동 배치 전');
    students = createEmptyLayout(totalStudents);
    Object.entries(fixedSeats).forEach(([indexStr, name]) => {
      students[Number(indexStr)] = name;
    });
    students[availableSeats[0]] = namesToRoll[0];
    saveState();
    initGrid();
    return;
  }

  const hasConstraints =
    requiredPairs.length > 0 || bannedPairs.length > 0 || frontRowStudents.length > 0 || separatedGroups.length > 0;

  let predeterminedOrder: string[] = [];
  if (hasConstraints) {
    const shuffled = [...namesToRoll];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    predeterminedOrder = rearrangeForConstraints(shuffled, fixedSeats);
  }

  saveState();
  localStorage.setItem('seating_fixed', JSON.stringify(fixedSeats));
  localStorage.setItem('seating_roster', JSON.stringify(roster));
  localStorage.setItem('seating_total_students', totalStudents.toString());
  localStorage.setItem('seating_full_students', JSON.stringify(roster));
  localStorage.setItem('seating_predetermined_order', JSON.stringify(predeterminedOrder));

  window.location.href = `index.html?seating_mode=true&seating_names=${encodeURIComponent(namesToRoll.join(','))}`;
});

window.addEventListener('DOMContentLoaded', () => {
  const hadState = loadState();
  if (hadState) {
    inputTotal.value = totalStudents.toString();
    inputCols.value = columns.toString();

    const rpEl = document.getElementById('valRequiredPairs') as HTMLInputElement;
    const bpEl = document.getElementById('valBannedPairs') as HTMLInputElement;
    const sepEl = document.getElementById('valSeparated') as HTMLInputElement;
    const frEl = document.getElementById('valFrontRow') as HTMLInputElement;
    if (rpEl && requiredPairs.length > 0) rpEl.value = requiredPairs.map((p) => p.join('-')).join(', ');
    if (bpEl && bannedPairs.length > 0) bpEl.value = bannedPairs.map((p) => p.join('-')).join(', ');
    if (sepEl && separatedGroups.length > 0) sepEl.value = formatSeparatedGroups(separatedGroups);
    if (frEl && frontRowStudents.length > 0) frEl.value = frontRowStudents.join(', ');
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('result') === 'ready') {
    pushHistory('룰렛 결과 적용 전');
    const resultNames: string[] = JSON.parse(localStorage.getItem('seating_result_winners') || '[]');
    const fixed: Record<string, string> = JSON.parse(localStorage.getItem('seating_fixed') || '{}');
    const savedRoster: string[] = JSON.parse(
      localStorage.getItem('seating_roster') || localStorage.getItem('seating_full_students') || '[]'
    );
    const savedTotal = parseInt(localStorage.getItem('seating_total_students') || '', 10);

    if (savedRoster.length > 0) roster = savedRoster;
    if (Number.isFinite(savedTotal) && savedTotal > 0) {
      totalStudents = savedTotal;
    } else if (roster.length > 0) {
      totalStudents = roster.length;
    }
    inputTotal.value = totalStudents.toString();

    students = createEmptyLayout(totalStudents);
    fixedSeats = {};
    for (const [k, v] of Object.entries(fixed)) {
      fixedSeats[parseInt(k, 10)] = v;
      students[parseInt(k, 10)] = v;
    }
    cleanFixedSeats();

    if (resultNames.length > 0) {
      const predeterminedOrder: string[] = JSON.parse(localStorage.getItem('seating_predetermined_order') || '[]');
      const namesToPlace = resultNames.length >= predeterminedOrder.length ? resultNames : predeterminedOrder;
      const fillableSeats = getFillableSeatIndices(namesToPlace.length);
      for (let i = 0; i < fillableSeats.length && i < namesToPlace.length; i++) {
        students[fillableSeats[i]] = namesToPlace[i];
      }
    }
    saveState();
  }

  initGrid();
});

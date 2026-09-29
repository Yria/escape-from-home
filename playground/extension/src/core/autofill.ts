// === Core Page Automation ===
// 페이지를 열고 순차적 액션(선택, 클릭, 대기, 입력)을 실행하는 공통 패턴
// 모든 프로바이더에서 재사용 가능

export type PageAction =
  | { type: 'fill'; selectors: string[]; value: string }
  | { type: 'click'; selector: string }
  | { type: 'check'; selector: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'wait'; selector: string; timeout?: number }
  | { type: 'delay'; ms: number };

export interface PageActionStep {
  url?: string;
  actions: PageAction[];
}

/**
 * 페이지 컨텍스트에서 실행되는 자립형 함수.
 * chrome.scripting.executeScript의 func로 주입되므로
 * 외부 모듈을 참조할 수 없다.
 */
const executeActions = async (actions: PageAction[]): Promise<void> => {
  for (const action of actions) {
    switch (action.type) {
      case 'fill': {
        for (const sel of action.selectors) {
          const el = document.querySelector(sel);
          if (el instanceof HTMLInputElement) {
            el.value = action.value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
        break;
      }
      case 'click': {
        const el = document.querySelector(action.selector);
        if (el instanceof HTMLElement) el.click();
        break;
      }
      case 'check': {
        const el = document.querySelector(action.selector);
        if (el instanceof HTMLInputElement) el.click();
        break;
      }
      case 'select': {
        const el = document.querySelector(action.selector);
        if (el instanceof HTMLSelectElement) {
          el.value = action.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
      }
      case 'wait': {
        const timeout = action.timeout ?? 5000;
        await new Promise<void>((resolve) => {
          if (document.querySelector(action.selector)) return resolve();
          const observer = new MutationObserver(() => {
            if (document.querySelector(action.selector)) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, timeout);
        });
        break;
      }
      case 'delay': {
        await new Promise<void>((r) => setTimeout(r, action.ms));
        break;
      }
    }
  }
};

/**
 * URL을 새 탭으로 열고, 로드 완료 후 액션 시퀀스를 실행한다.
 */
export const openAndExecute = (url: string, actions: PageAction[]): void => {
  if (actions.length === 0) {
    chrome.tabs.create({ url });
    return;
  }

  let targetTabId: number | null = null;
  let executed = false;

  const tryExecute = (tabId: number) => {
    if (executed) return;
    executed = true;
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.scripting.executeScript({
      target: { tabId },
      func: executeActions,
      args: [actions],
    });
  };

  const onUpdated = (
    updatedId: number,
    info: chrome.tabs.OnUpdatedInfo,
  ) => {
    if (targetTabId !== null && updatedId === targetTabId && info.status === 'complete') {
      tryExecute(targetTabId);
    }
  };

  // 리스너를 탭 생성 전에 등록하여 race condition 방지
  chrome.tabs.onUpdated.addListener(onUpdated);

  chrome.tabs.create({ url }, (tab) => {
    if (!tab?.id) {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      return;
    }
    targetTabId = tab.id;

    // 탭이 이미 완료 상태인지 확인 (캐시된 페이지 등)
    chrome.tabs.get(tab.id, (t) => {
      if (t?.status === 'complete') {
        tryExecute(tab.id!);
      }
    });
  });
};

/**
 * 다단계 액션 시퀀스를 순차 실행한다.
 * 첫 번째 step의 url로 탭을 열고 actions 실행 →
 * 페이지 전환 감지(onUpdated status==='complete') → 다음 step의 actions 실행 → 반복.
 * 각 단계의 마지막 액션이 페이지 전환을 유발한다고 가정한다.
 */
export const openAndExecuteSteps = (
  steps: PageActionStep[],
): void => {
  if (steps.length === 0) return;
  const firstUrl = steps[0].url;
  if (!firstUrl) return;

  let targetTabId: number | null = null;
  let stepIndex = 0;

  const runStep = (tabId: number) => {
    const step = steps[stepIndex];
    if (!step || step.actions.length === 0) return;

    const currentStep = stepIndex;
    console.log(`[EFH] executeScript step ${currentStep}:`, step.actions.length, 'actions');
    chrome.scripting.executeScript({
      target: { tabId },
      func: executeActions,
      args: [step.actions],
    }).then((results) => {
      console.log(`[EFH] executeScript step ${currentStep} done`, results);
    }).catch((err) => {
      console.error(`[EFH] executeScript step ${currentStep} failed`, err);
    });
  };

  const advanceStep = (tabId: number) => {
    if (stepIndex < steps.length) {
      runStep(tabId);
      stepIndex++;

      if (stepIndex >= steps.length) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    }
  };

  const onUpdated = (
    updatedId: number,
    info: chrome.tabs.OnUpdatedInfo,
  ) => {
    if (targetTabId === null || updatedId !== targetTabId || info.status !== 'complete') return;
    console.log(`[EFH] onUpdated complete, stepIndex=${stepIndex}`);
    advanceStep(targetTabId);
  };

  // 리스너를 탭 생성 전에 등록하여 race condition 방지
  chrome.tabs.onUpdated.addListener(onUpdated);

  console.log('[EFH] openAndExecuteSteps: creating tab', firstUrl);
  chrome.tabs.create({ url: firstUrl }, (tab) => {
    if (!tab?.id) {
      console.log('[EFH] openAndExecuteSteps: tab creation failed');
      chrome.tabs.onUpdated.removeListener(onUpdated);
      return;
    }

    targetTabId = tab.id;
    console.log('[EFH] openAndExecuteSteps: tab created', tab.id);

    // 탭이 이미 완료 상태인지 확인 (캐시된 페이지 등)
    chrome.tabs.get(tab.id, (t) => {
      if (t?.status === 'complete') {
        advanceStep(tab.id!);
      }
    });
  });
};

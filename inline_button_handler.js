(() => {
  console.log("[Tiny Memo - Inline Button] Handler loaded.");

  let memoButton = null;
  let ttsButton = null;
  let hoverMemoIcon = null;
  let hoverTtsIcon = null;

  const SELECTION_BUTTON_ID = "tiny-memo-selection-button";
  const SELECTION_TTS_BUTTON_ID = "tiny-memo-selection-tts-button";
  const HOVER_MEMO_ICON_ID = "tiny-memo-hover-memo-icon";
  const HOVER_TTS_ICON_ID = "tiny-memo-hover-tts-icon";
  const HOVER_CONTAINER_CLASS = "tiny-memo-hover-container";

  // SVG Icons (light-colored)
  const ADD_NOTE_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="12" y1="18" x2="12" y2="12"></line>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>`;

  const PLAY_TTS_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>`;

  let autoTtsEnabled = false;
  let hoverButtonsEnabled = false;
  let isAutoTtsPlaying = false;
  let lastHoveredElement = null;
  let hideHoverIconsTimeout = null;
  let iconsContainer = null;
  let siteConfigs = []; // 存储网站配置

  // 加载设置
  chrome.storage.local.get(["autoTtsSetting", "hoverButtonsSetting", "siteConfigs"], (result) => {
    autoTtsEnabled = result.autoTtsSetting === true;
    hoverButtonsEnabled = result.hoverButtonsSetting === true;
    siteConfigs = result.siteConfigs || [];
    console.log("[Tiny Memo - Inline Button] 自动TTS设置:", autoTtsEnabled, "悬停按钮设置:", hoverButtonsEnabled);
    console.log("[Tiny Memo - Inline Button] 网站配置:", siteConfigs);
  });

  // 监听存储变化，实时更新设置
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.autoTtsSetting) {
        autoTtsEnabled = changes.autoTtsSetting.newValue === true;
        console.log("[Tiny Memo - Inline Button] 自动TTS设置已更新:", autoTtsEnabled);
      }
      if (changes.hoverButtonsSetting) {
        hoverButtonsEnabled = changes.hoverButtonsSetting.newValue === true;
        console.log("[Tiny Memo - Inline Button] 悬停按钮设置已更新:", hoverButtonsEnabled);
        // 如果禁用了悬停按钮，立即隐藏它们
        if (!hoverButtonsEnabled) {
          hideHoverIcons();
        }
      }
      if (changes.siteConfigs) {
        siteConfigs = changes.siteConfigs.newValue || [];
        console.log("[Tiny Memo - Inline Button] 网站配置已更新:", siteConfigs);
      }
    }
  });

  function createSelectionButton(id, text, borderColor) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    Object.assign(button.style, {
      position: "absolute",
      zIndex: "2147483646",
      backgroundColor: "#282c34",
      color: "white",
      border: `1px solid ${borderColor}`,
      borderRadius: "4px",
      padding: "5px 8px",
      fontSize: "12px",
      cursor: "pointer",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      display: "none",
    });
    document.body.appendChild(button);
    return button;
  }

  function createIconsContainer() {
    if (iconsContainer) return iconsContainer;

    const container = document.createElement("span");
    container.className = HOVER_CONTAINER_CLASS;
    container.dataset.tinyMemoContainer = "true";
    Object.assign(container.style, {
      display: "inline-block",
      position: "absolute",
      zIndex: "2147483646",
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: "4px",
      padding: "2px 4px",
      right: "10px",
      top: "0",
      verticalAlign: "middle",
      lineHeight: "1",
      pointerEvents: "auto",
    });

    container.addEventListener("mouseenter", () => {
      clearTimeout(hideHoverIconsTimeout);
    });

    container.addEventListener("mouseleave", () => {
      if (lastHoveredElement && !lastHoveredElement.contains(container)) {
        scheduleHideHoverIcons();
      }
    });

    iconsContainer = container;
    return container;
  }

  function createHoverIcon(id, svgIcon) {
    const iconSpan = document.createElement("span");
    iconSpan.id = id;
    iconSpan.innerHTML = svgIcon;
    iconSpan.dataset.tinyMemoIcon = "true"; // Mark as our icon
    Object.assign(iconSpan.style, {
      cursor: "pointer",
      marginLeft: "4px",
      marginRight: "4px",
      verticalAlign: "middle", // Align with text
      display: "inline-block",
      lineHeight: "1", // Prevent extra spacing
      padding: "2px", // 增加点击区域
    });
    // Event listeners will be added when shown/created
    return iconSpan;
  }

  function getSelectionMemoButton() {
    if (!memoButton) {
      memoButton = createSelectionButton(SELECTION_BUTTON_ID, "添加到笔记", "#4CAF50");
      memoButton.addEventListener("click", (event) => handleMemoButtonClick(event, window.getSelection().toString().trim(), true));
    }
    return memoButton;
  }

  function getSelectionTtsButton() {
    if (!ttsButton) {
      ttsButton = createSelectionButton(SELECTION_TTS_BUTTON_ID, "播放语音", "#4285f4");
      ttsButton.addEventListener("click", (event) => handleTtsButtonClick(event, window.getSelection().toString().trim()));
    }
    return ttsButton;
  }

  function getHoverMemoIcon() {
    if (!hoverMemoIcon) {
      hoverMemoIcon = createHoverIcon(HOVER_MEMO_ICON_ID, ADD_NOTE_ICON_SVG);
      hoverMemoIcon.addEventListener("click", (event) => {
        if (lastHoveredElement) {
          handleMemoButtonClick(event, lastHoveredElement.innerText.trim(), false);
        }
      });
    }
    return hoverMemoIcon;
  }

  function getHoverTtsIcon() {
    if (!hoverTtsIcon) {
      hoverTtsIcon = createHoverIcon(HOVER_TTS_ICON_ID, PLAY_TTS_ICON_SVG);
      hoverTtsIcon.addEventListener("click", (event) => {
        if (lastHoveredElement) {
          handleTtsButtonClick(event, lastHoveredElement.innerText.trim());
        }
      });
    }
    return hoverTtsIcon;
  }

  function handleMemoButtonClick(event, text, fromSelection) {
    event.stopPropagation();
    event.preventDefault(); // 防止任何默认行为

    if (text) {
      console.log(`[Tiny Memo - ${fromSelection ? "Selection" : "Hover"} Button] Add to notes:`, text);

      try {
        if (!chrome || !chrome.runtime) {
          console.error("[Tiny Memo] Chrome runtime not available");
          showTtsErrorNotification("浏览器扩展环境不可用，请刷新页面");
          return;
        }

        chrome.runtime.sendMessage({ type: "SELECTION_FROM_CONTENT_SCRIPT", text: text }, () => {
          if (chrome.runtime.lastError) {
            console.error("[Tiny Memo] Error sending note:", chrome.runtime.lastError.message);
            showTtsErrorNotification("添加笔记失败: " + chrome.runtime.lastError.message);
            return;
          }
          // Optionally show a success notification for hover-added notes
          if (!fromSelection) {
            showTemporarySuccessInIcon(event.currentTarget);
          }
        });
      } catch (error) {
        console.error("[Tiny Memo] Error in sending note:", error);
        showTtsErrorNotification("添加笔记出错: " + error.message);
      }
    }

    if (fromSelection) {
      hideSelectionButtons();
    } else {
      // For hover icons, they might be removed by mouseout, or clicking could also hide them.
      // Let's explicitly hide to give immediate feedback.
      hideHoverIcons();
    }
  }

  function showTemporarySuccessInIcon(iconElement) {
    const originalIcon = iconElement.innerHTML;
    // Checkmark SVG (or similar success indicator)
    iconElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => {
      if (document.body.contains(iconElement)) {
        // Check if icon is still in DOM
        iconElement.innerHTML = originalIcon;
      }
    }, 1500);
  }

  async function handleTtsButtonClick(event, text) {
    event.stopPropagation();
    event.preventDefault(); // 防止任何默认行为

    const iconElement = event.currentTarget; // The clicked span/icon
    if (text) {
      console.log("[Tiny Memo - TTS Button] Requesting TTS for:", text);
      // No loading state for icons to keep them simple, TTS happens quickly or shows error notification

      try {
        if (!chrome || !chrome.runtime) {
          console.error("[Tiny Memo - TTS Button] Chrome runtime not available");
          showTtsErrorNotification("浏览器扩展环境不可用，请刷新页面");
          return;
        }

        chrome.runtime.sendMessage({ type: "TTS_REQUEST", text: text }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Tiny Memo - TTS Button] Error requesting TTS:", chrome.runtime.lastError.message);
            showTtsErrorNotification("TTS请求失败: " + chrome.runtime.lastError.message);
          } else if (response && response.success && response.audio_url) {
            console.log("[Tiny Memo - TTS Button] TTS audio URL received:", response.audio_url);
            playTtsAudio(response.audio_url);
          } else {
            console.error("[Tiny Memo - TTS Button] TTS request failed:", response?.error);
            showTtsErrorNotification("TTS生成失败: " + (response?.error || "未知错误"));
          }
        });
      } catch (error) {
        console.error("[Tiny Memo - TTS Button] Error in TTS request:", error);
        showTtsErrorNotification("TTS请求出错: " + error.message);
      }
    }
  }

  function playTtsAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch((error) => {
      console.error("[Tiny Memo - TTS Icon] Error playing audio:", error);
      showTtsErrorNotification("音频播放失败");
    });
  }

  function requestAndPlayTts(text) {
    if (!text || isAutoTtsPlaying) return;
    isAutoTtsPlaying = true;
    console.log("[Tiny Memo - Auto TTS] Requesting TTS for:", text);

    try {
      if (!chrome || !chrome.runtime) {
        console.error("[Tiny Memo - Auto TTS] Chrome runtime not available");
        isAutoTtsPlaying = false;
        return;
      }

      chrome.runtime.sendMessage({ type: "TTS_REQUEST", text: text }, (response) => {
        isAutoTtsPlaying = false;
        if (chrome.runtime.lastError) {
          console.error("[Tiny Memo - Auto TTS] Error requesting TTS:", chrome.runtime.lastError.message);
        } else if (response && response.success && response.audio_url) {
          console.log("[Tiny Memo - Auto TTS] TTS audio URL received:", response.audio_url);
          playTtsAudio(response.audio_url);
        } else {
          console.error("[Tiny Memo - Auto TTS] TTS request failed:", response?.error);
        }
      });
    } catch (error) {
      console.error("[Tiny Memo - Auto TTS] Error in TTS request:", error);
      isAutoTtsPlaying = false;
    }
  }

  function showSelectionButtons(x, y) {
    const mButton = getSelectionMemoButton();
    const tButton = getSelectionTtsButton();
    mButton.style.left = `${x + 5}px`;
    mButton.style.top = `${y + window.scrollY - 5}px`;
    mButton.style.display = "block";

    const memoWidth = mButton.getBoundingClientRect().width;
    tButton.style.left = `${x + 15 + memoWidth}px`;
    tButton.style.top = `${y + window.scrollY - 5}px`;
    tButton.style.display = "block";
  }

  function hideSelectionButtons() {
    if (memoButton && memoButton.style.display !== "none") memoButton.style.display = "none";
    if (ttsButton && ttsButton.style.display !== "none") ttsButton.style.display = "none";
  }

  function showHoverIcons(element) {
    if (!hoverButtonsEnabled || !element || !element.parentNode) return;

    // 如果元素已经有图标，则不做任何事
    if (element.querySelector(`.${HOVER_CONTAINER_CLASS}`)) {
      return;
    }

    // If icons are already shown for this element, do nothing
    if (lastHoveredElement === element && document.querySelector(`.${HOVER_CONTAINER_CLASS}`)) {
      clearTimeout(hideHoverIconsTimeout); // Keep them visible
      return;
    }

    // Remove any existing icon containers
    hideHoverIcons();

    lastHoveredElement = element;
    clearTimeout(hideHoverIconsTimeout);

    // Create container and append icons to it
    const container = createIconsContainer();
    const hMemoIcon = getHoverMemoIcon();
    const hTtsIcon = getHoverTtsIcon();

    // Add icons to container
    container.appendChild(hMemoIcon);
    container.appendChild(hTtsIcon);

    // 放置容器在元素的上方右侧
    try {
      // 设置元素为相对定位，这样绝对定位的容器会基于它
      const originalPosition = element.style.position;
      if (originalPosition !== "absolute" && originalPosition !== "fixed" && originalPosition !== "relative") {
        element.style.position = "relative";
      }

      element.appendChild(container);
      console.log("[Tiny Memo] 已添加悬停图标到元素:", element);
    } catch (error) {
      console.error("[Tiny Memo] 添加悬停图标失败:", error);
    }
  }

  function scheduleHideHoverIcons() {
    clearTimeout(hideHoverIconsTimeout);
    hideHoverIconsTimeout = setTimeout(() => {
      hideHoverIcons();
    }, 500); // 增加延迟，给用户更多时间移动到按钮上
  }

  function hideHoverIcons() {
    // Remove container if it exists
    const container = document.querySelector(`.${HOVER_CONTAINER_CLASS}`);
    if (container) {
      container.remove();
    }

    // Reset state
    lastHoveredElement = null;
    currentHoverElement = null;
  }

  // --- Event Listeners ---
  document.addEventListener("mouseup", (event) => {
    // Skip if clicked on our controls
    if (event.target.dataset?.tinyMemoIcon || event.target.dataset?.tinyMemoContainer || event.target.closest(`[data-tiny-memo-icon="true"]`) || event.target.closest(`.${HOVER_CONTAINER_CLASS}`) || event.target.id === SELECTION_BUTTON_ID || event.target.id === SELECTION_TTS_BUTTON_ID) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
      hideHoverIcons();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showSelectionButtons(rect.right, rect.bottom);
      if (autoTtsEnabled) {
        requestAndPlayTts(selectedText);
      }
    } else {
      hideSelectionButtons();
    }
  });

  document.addEventListener(
    "mousedown",
    (event) => {
      // Skip if clicked on our controls
      if (event.target.dataset?.tinyMemoIcon || event.target.dataset?.tinyMemoContainer || event.target.closest(`[data-tiny-memo-icon="true"]`) || event.target.closest(`.${HOVER_CONTAINER_CLASS}`) || event.target.id === SELECTION_BUTTON_ID || event.target.id === SELECTION_TTS_BUTTON_ID) return;

      if ((memoButton && memoButton.style.display === "block") || (ttsButton && ttsButton.style.display === "block")) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.getRangeAt(0).toString().trim()) {
          hideSelectionButtons();
        }
      }
    },
    true
  );

  let selectionHideTimeout = null;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionHideTimeout);
    selectionHideTimeout = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.getRangeAt(0).toString().trim()) {
        if (
          document.activeElement &&
          document.activeElement.id !== SELECTION_BUTTON_ID &&
          document.activeElement.id !== SELECTION_TTS_BUTTON_ID &&
          !document.activeElement.dataset?.tinyMemoIcon &&
          !document.activeElement.dataset?.tinyMemoContainer &&
          !document.activeElement.closest('[data-tiny-memo-icon="true"]') &&
          !document.activeElement.closest(`.${HOVER_CONTAINER_CLASS}`)
        ) {
          hideSelectionButtons();
        }
      }
    }, 150);
  });

  // Track the element that currently has hover icons
  let currentHoverElement = null;

  document.addEventListener("mouseover", (event) => {
    if (!hoverButtonsEnabled) return;

    // 如果正在悬停在我们的图标/容器上，不要做任何改变
    if (event.target.dataset?.tinyMemoIcon || event.target.dataset?.tinyMemoContainer || event.target.closest(`[data-tiny-memo-icon="true"]`) || event.target.closest(`.${HOVER_CONTAINER_CLASS}`)) {
      clearTimeout(hideHoverIconsTimeout); // 保持图标可见
      return;
    }

    const target = findHoverableParent(event.target);

    // 如果找到了有效的可悬停元素
    if (target) {
      // 如果已经在这个元素上显示了，不做任何事
      if (currentHoverElement === target && document.querySelector(`.${HOVER_CONTAINER_CLASS}`)) {
        clearTimeout(hideHoverIconsTimeout);
        return;
      }

      // 移除上一个元素的图标
      if (currentHoverElement && currentHoverElement !== target) {
        hideHoverIcons();
      }

      // 为新元素显示图标
      currentHoverElement = target;
      showHoverIcons(target);
    }
  });

  // 检查当前元素是否匹配配置的选择器
  function matchesConfiguredSelector(element) {
    // 如果没有配置或配置为空，始终返回true以保持默认行为
    if (!siteConfigs || siteConfigs.length === 0) {
      return true;
    }

    // 获取当前网站域名
    const currentDomain = window.location.hostname;

    // 查找匹配当前域名的配置
    const matchingConfigs = siteConfigs.filter(
      (config) => currentDomain === config.domain || currentDomain.endsWith(`.${config.domain}`) || config.domain === "*" // 允许通配符
    );

    // 如果没有匹配的域名配置，则不显示
    if (matchingConfigs.length === 0) {
      return false;
    }

    // 检查元素是否匹配任何配置的选择器
    for (const config of matchingConfigs) {
      try {
        // 如果选择器是通配符，匹配所有元素
        if (config.selector === "*") {
          return true;
        }

        // 检查元素本身是否匹配
        if (element.matches(config.selector)) {
          return true;
        }

        // 检查元素是否包含在匹配选择器的元素内
        if (element.closest(config.selector)) {
          return true;
        }

        // 检查元素是否包含匹配选择器的子元素
        if (element.querySelector(config.selector)) {
          return true;
        }
      } catch (error) {
        console.error("[Tiny Memo] 无效的CSS选择器:", config.selector, error);
      }
    }

    return false;
  }

  // Find a valid parent element to hover on
  function findHoverableParent(element) {
    // 跳过我们自己的控件元素
    if (!element || element.dataset?.tinyMemoIcon || element.dataset?.tinyMemoContainer || element.closest('[data-tiny-memo-icon="true"]') || element.closest(`.${HOVER_CONTAINER_CLASS}`)) {
      return null;
    }

    // 先检查当前元素是否已被标记为可悬停
    if (element.dataset?.tinyMemoScanned) {
      return element;
    }

    // 检查是否有已标记的父元素
    const markedParent = element.closest('[data-tiny-memo-scanned="true"]');
    if (markedParent) {
      return markedParent;
    }

    // 从元素本身开始
    let current = element;

    // 向上遍历DOM树查找合适的容器
    while (current && current !== document.body) {
      // 主要检查段落元素
      if (
        current.tagName &&
        ["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "ARTICLE", "SECTION"].includes(current.tagName.toUpperCase()) &&
        current.innerText &&
        current.innerText.trim().length > 10 && // 包含足够的文本
        current.offsetHeight > 0 &&
        current.offsetWidth > 0 &&
        !current.isContentEditable &&
        !current.contains(document.querySelector(`.${HOVER_CONTAINER_CLASS}`)) && // 避免重复添加
        window.getComputedStyle(current).visibility !== "hidden" &&
        window.getComputedStyle(current).display !== "none" &&
        !current.closest("button, input, textarea, select, a[href], label, summary") &&
        matchesConfiguredSelector(current) // 检查是否匹配配置的选择器
      ) {
        // 标记该元素已被识别为可悬停
        current.dataset.tinyMemoScanned = "true";
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  document.addEventListener("mouseout", (event) => {
    if (!hoverButtonsEnabled) return;

    const relatedTarget = event.relatedTarget;

    // 不要隐藏，如果鼠标移动到我们的图标或容器上
    if (relatedTarget && (relatedTarget.dataset?.tinyMemoIcon || relatedTarget.dataset?.tinyMemoContainer || relatedTarget.closest('[data-tiny-memo-icon="true"]') || relatedTarget.closest(`.${HOVER_CONTAINER_CLASS}`))) {
      return;
    }

    // 检查我们是否离开了一个已悬停的元素
    if (currentHoverElement) {
      // 检查relatedTarget是否是当前悬停元素的子元素
      if (currentHoverElement.contains(relatedTarget)) {
        return; // 仍然在悬停元素内部，不要隐藏
      }

      // 检查我们是否移动到另一个有效的可悬停元素
      const targetHoverable = findHoverableParent(relatedTarget);
      if (!targetHoverable) {
        // 如果不是移动到另一个可悬停元素或我们的图标，则安排隐藏
        scheduleHideHoverIcons();
      }
    }
  });

  // Pre-create selection buttons
  getSelectionMemoButton();
  getSelectionTtsButton();

  // 添加MutationObserver监听DOM变化
  function setupMutationObserver() {
    console.log("[Tiny Memo] 设置MutationObserver监听DOM变化");

    // 创建一个观察器实例
    const observer = new MutationObserver((mutations) => {
      if (!hoverButtonsEnabled) return;

      let shouldScan = false;
      let addedNodes = [];

      // 检查是否有新元素添加
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldScan = true;
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // 元素节点
              addedNodes.push(node);
            }
          });
        }
      }

      // 如果有新元素添加，处理这些元素
      if (shouldScan && addedNodes.length > 0) {
        // 使用防抖函数延迟处理，避免频繁触发
        clearTimeout(domMutationTimeout);
        domMutationTimeout = setTimeout(() => {
          console.log(`[Tiny Memo] 检测到DOM变化，有 ${addedNodes.length} 个新元素`);

          // 1. 检查这些新元素是否匹配我们的配置
          processNewElements(addedNodes);

          // 2. 定期全面扫描，确保不遗漏
          scanPageForHoverableElements();
        }, 300);
      }
    });

    // 配置观察选项
    const config = {
      childList: true, // 观察目标子节点的变化
      subtree: true, // 观察所有后代节点
    };

    // 开始观察document.body
    observer.observe(document.body, config);

    console.log("[Tiny Memo] MutationObserver已启动");
  }

  // 处理新添加的元素
  function processNewElements(nodes) {
    if (!nodes || nodes.length === 0) return;

    // 获取当前域名
    const currentDomain = window.location.hostname;

    // 查找匹配当前域名的配置
    const matchingConfigs = siteConfigs.filter((config) => currentDomain === config.domain || currentDomain.endsWith(`.${config.domain}`) || config.domain === "*");

    // 如果没有匹配的域名配置，则不处理
    if (matchingConfigs.length === 0 && siteConfigs.length > 0) {
      return;
    }

    // 对每个配置，检查新节点是否匹配
    matchingConfigs.forEach((config) => {
      try {
        if (config.selector && config.selector !== "*") {
          // 检查每个新节点
          nodes.forEach((node) => {
            // 检查节点本身是否匹配选择器
            try {
              if (node.matches && node.matches(config.selector)) {
                console.log("[Tiny Memo] 发现匹配的新容器元素:", node);
                processContainerForTextElements(node);
              }
            } catch (e) {
              // 忽略选择器匹配错误
            }

            // 检查节点是否包含匹配选择器的元素
            try {
              if (node.querySelectorAll) {
                const matchingElements = node.querySelectorAll(config.selector);
                if (matchingElements.length > 0) {
                  console.log(`[Tiny Memo] 在新节点中找到 ${matchingElements.length} 个匹配容器`);
                  matchingElements.forEach((el) => processContainerForTextElements(el));
                }
              }
            } catch (e) {
              console.error("[Tiny Memo] 查询子元素时出错:", e);
            }

            // 检查该节点是否是匹配容器内的文本元素
            try {
              const container = node.closest && node.closest(config.selector);
              if (container) {
                // 如果新节点在容器内，直接检查它是否是文本元素
                if (node.innerText && node.innerText.trim().length > 10) {
                  if (!node.dataset.tinyMemoScanned && !node.isContentEditable && node.offsetHeight > 0 && node.offsetWidth > 0) {
                    node.dataset.tinyMemoScanned = "true";
                    console.log("[Tiny Memo] 标记容器内的新文本元素:", node.tagName);
                  }
                }
              }
            } catch (e) {
              // 忽略closest查询错误
            }
          });
        }
      } catch (error) {
        console.error("[Tiny Memo] 处理新元素时出错:", error);
      }
    });
  }

  let domMutationTimeout = null;

  // 扫描页面寻找可悬停元素
  function scanPageForHoverableElements() {
    if (!hoverButtonsEnabled) return;

    // 获取当前域名
    const currentDomain = window.location.hostname;

    // 查找匹配当前域名的配置
    const matchingConfigs = siteConfigs.filter((config) => currentDomain === config.domain || currentDomain.endsWith(`.${config.domain}`) || config.domain === "*");

    // 如果没有匹配的域名配置，则不扫描
    if (matchingConfigs.length === 0 && siteConfigs.length > 0) {
      return;
    }

    // 对每个配置，尝试找到匹配的元素
    matchingConfigs.forEach((config) => {
      try {
        if (config.selector && config.selector !== "*") {
          // 使用配置的选择器查找元素
          const containerElements = document.querySelectorAll(config.selector);
          console.log(`[Tiny Memo] 在配置 ${config.domain} 下找到 ${containerElements.length} 个容器元素`);

          if (containerElements.length === 0) {
            // 尝试使用更宽松的选择器
            console.log(`[Tiny Memo] 尝试使用更宽松的选择器: ${config.selector.split(" ")[0]}`);
            const baseSelector = config.selector.split(" ")[0]; // 获取选择器的第一部分
            if (baseSelector && baseSelector !== config.selector) {
              const alternativeElements = document.querySelectorAll(baseSelector);
              if (alternativeElements.length > 0) {
                console.log(`[Tiny Memo] 使用宽松选择器找到 ${alternativeElements.length} 个元素`);
              }
            }
          }

          // 对找到的每个容器元素，扫描其内部的文本块
          containerElements.forEach((container) => {
            // 1. 找出所有的段落和文本元素
            processContainerForTextElements(container);
          });
        }
      } catch (error) {
        console.error("[Tiny Memo] 扫描元素时出错:", error);
      }
    });
  }

  // 处理容器内的文本元素
  function processContainerForTextElements(container) {
    if (!container) return;

    console.log("[Tiny Memo] 处理容器:", container);

    // 查找容器内的文本块元素
    const textElementTags = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "DIV", "SPAN", "ARTICLE", "SECTION"];
    const potentialTextElements = [];

    // 方法1: 直接查找常见文本元素标签下的所有元素（包括嵌套元素）
    textElementTags.forEach((tag) => {
      // 先获取直接子元素
      const elements = container.querySelectorAll(`:scope > ${tag}, ${tag}`);
      elements.forEach((el) => {
        // 确保元素有足够的文本内容
        if (el.innerText && el.innerText.trim().length > 10) {
          potentialTextElements.push(el);
        }
      });
    });

    // 方法2: 递归查找容器内所有子元素
    function findTextElements(element) {
      if (!element || element.nodeType !== 1) return;

      // 检查当前元素是否有足够的文本内容
      if (element.innerText && element.innerText.trim().length > 10 && !potentialTextElements.includes(element)) {
        potentialTextElements.push(element);
      }

      // 递归检查所有子元素
      if (element.children && element.children.length > 0) {
        Array.from(element.children).forEach((child) => {
          findTextElements(child);
        });
      }
    }

    // 递归查找所有子元素
    findTextElements(container);

    console.log(`[Tiny Memo] 找到 ${potentialTextElements.length} 个潜在文本元素`);

    // 标记这些元素为可悬停
    potentialTextElements.forEach((element) => {
      markAsHoverable(element);
    });
  }

  // 将元素标记为可悬停
  function markAsHoverable(element) {
    if (!element) return;

    try {
      if (
        !element.dataset.tinyMemoScanned &&
        !element.querySelector(`.${HOVER_CONTAINER_CLASS}`) &&
        !element.isContentEditable &&
        element.offsetHeight > 0 &&
        element.offsetWidth > 0 &&
        window.getComputedStyle(element).visibility !== "hidden" &&
        window.getComputedStyle(element).display !== "none" &&
        !element.closest("button, input, textarea, select, a[href], label, summary")
      ) {
        // 标记为已扫描，这样鼠标悬停时能识别
        element.dataset.tinyMemoScanned = "true";
        console.log("[Tiny Memo] 标记文本元素:", element.tagName, element.innerText.substring(0, 20) + "...");
      }
    } catch (error) {
      console.error("[Tiny Memo] 标记元素时出错:", error);
    }
  }

  // 初始延迟后启动观察器
  setTimeout(() => {
    setupMutationObserver();
    // 初次扫描页面
    scanPageForHoverableElements();
  }, 1000);

  function showTtsErrorNotification(errorMessage) {
    const existingNotification = document.getElementById("tiny-memo-tts-error");
    if (existingNotification) existingNotification.remove();
    const notificationId = "tiny-memo-tts-error";
    const notification = document.createElement("div");
    notification.id = notificationId;
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      backgroundColor: "rgba(220, 53, 69, 0.9)",
      color: "#FFFFFF",
      padding: "12px 16px",
      borderRadius: "6px",
      zIndex: "2147483647",
      fontFamily: "sans-serif",
      fontSize: "14px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
      opacity: "0",
      transition: "opacity 0.3s ease-in-out",
      maxWidth: "300px",
    });
    const message = document.createElement("span");
    message.textContent = errorMessage;
    notification.appendChild(message);
    document.body.appendChild(notification);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notification.style.opacity = "1";
      });
    });
    const timeoutId = setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }, 3000);
    notification.onmouseenter = () => clearTimeout(timeoutId);
    notification.onmouseleave = () => {
      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => {
          if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
      }, 1500);
    };
  }
})();

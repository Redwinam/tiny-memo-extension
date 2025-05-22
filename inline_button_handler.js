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

  // 加载设置
  chrome.storage.local.get(["autoTtsSetting", "hoverButtonsSetting"], (result) => {
    autoTtsEnabled = result.autoTtsSetting === true;
    hoverButtonsEnabled = result.hoverButtonsSetting === true;
    console.log("[Tiny Memo - Inline Button] 自动TTS设置:", autoTtsEnabled, "悬停按钮设置:", hoverButtonsEnabled);
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
      position: "relative",
      zIndex: "2147483646",
      // backgroundColor: "rgba(0,0,0,0.3)",
      // borderRadius: "4px",
      // padding: "2px 4px",
      // marginLeft: "4px",
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
      chrome.runtime.sendMessage({ type: "SELECTION_FROM_CONTENT_SCRIPT", text: text }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Tiny Memo] Error sending note:", chrome.runtime.lastError.message);
          return;
        }
        // Optionally show a success notification for hover-added notes
        if (!fromSelection) {
          showTemporarySuccessInIcon(event.currentTarget);
        }
      });
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

    // 直接附加到元素末尾而不是放在viewport右侧
    element.appendChild(container);
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

  // Find a valid parent element to hover on
  function findHoverableParent(element) {
    // 跳过我们自己的控件元素
    if (!element || element.dataset?.tinyMemoIcon || element.dataset?.tinyMemoContainer || element.closest('[data-tiny-memo-icon="true"]') || element.closest(`.${HOVER_CONTAINER_CLASS}`)) {
      return null;
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
        !current.closest("button, input, textarea, select, a[href], label, summary")
      ) {
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

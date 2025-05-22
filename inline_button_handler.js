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

  function createHoverIcon(id, svgIcon) {
    const iconSpan = document.createElement("span");
    iconSpan.id = id;
    iconSpan.innerHTML = svgIcon;
    iconSpan.dataset.tinyMemoIcon = "true"; // Mark as our icon
    Object.assign(iconSpan.style, {
      cursor: "pointer",
      marginLeft: "5px",
      marginRight: "3px",
      verticalAlign: "middle", // Align with text
      display: "none", // Initially hidden
      lineHeight: "1", // Prevent extra spacing
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
    if (lastHoveredElement === element && ((hoverMemoIcon && hoverMemoIcon.parentNode === element) || (hoverTtsIcon && hoverTtsIcon.parentNode === element))) {
      clearTimeout(hideHoverIconsTimeout); // Keep them visible
      return;
    }

    // If icons are shown elsewhere, hide them first
    if (lastHoveredElement && lastHoveredElement !== element) {
      hideHoverIcons();
    }

    lastHoveredElement = element;
    clearTimeout(hideHoverIconsTimeout);

    const hMemoIcon = getHoverMemoIcon();
    const hTtsIcon = getHoverTtsIcon();

    // Append icons to the end of the element's content
    // Ensure they are not already children of this element from a previous quick mouseover/out
    if (hMemoIcon.parentNode !== element) element.appendChild(hMemoIcon);
    if (hTtsIcon.parentNode !== element) element.appendChild(hTtsIcon);

    hMemoIcon.style.display = "inline-block";
    hTtsIcon.style.display = "inline-block";
  }

  function scheduleHideHoverIcons() {
    clearTimeout(hideHoverIconsTimeout);
    hideHoverIconsTimeout = setTimeout(() => {
      hideHoverIcons();
    }, 300);
  }

  function hideHoverIcons() {
    if (hoverMemoIcon && hoverMemoIcon.parentNode) {
      hoverMemoIcon.parentNode.removeChild(hoverMemoIcon);
      hoverMemoIcon.style.display = "none";
    }
    if (hoverTtsIcon && hoverTtsIcon.parentNode) {
      hoverTtsIcon.parentNode.removeChild(hoverTtsIcon);
      hoverTtsIcon.style.display = "none";
    }
    if (lastHoveredElement === hoverMemoIcon?.parentNode || lastHoveredElement === hoverTtsIcon?.parentNode) {
      lastHoveredElement = null;
    }
  }

  // --- Event Listeners ---
  document.addEventListener("mouseup", (event) => {
    if (event.target.dataset.tinyMemoIcon || event.target.closest(`[data-tiny-memo-icon="true"]`) || event.target.id === SELECTION_BUTTON_ID || event.target.id === SELECTION_TTS_BUTTON_ID) return;

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
      if (event.target.dataset.tinyMemoIcon || event.target.closest(`[data-tiny-memo-icon="true"]`) || event.target.id === SELECTION_BUTTON_ID || event.target.id === SELECTION_TTS_BUTTON_ID) return;

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
        if (document.activeElement && document.activeElement.id !== SELECTION_BUTTON_ID && document.activeElement.id !== SELECTION_TTS_BUTTON_ID && !document.activeElement.dataset.tinyMemoIcon && !document.activeElement.closest('[data-tiny-memo-icon="true"]')) {
          hideSelectionButtons();
        }
      }
    }, 150);
  });

  document.addEventListener("mouseover", (event) => {
    if (!hoverButtonsEnabled || event.target.dataset.tinyMemoIcon || event.target.closest('[data-tiny-memo-icon="true"]')) {
      if (event.target.dataset.tinyMemoIcon || event.target.closest('[data-tiny-memo-icon="true"]')) {
        clearTimeout(hideHoverIconsTimeout); // Keep icons visible if mouse is over them
      }
      return;
    }

    const target = event.target;
    if (
      target.tagName &&
      ["P", "SPAN", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "BLOCKQUOTE", "PRE"].includes(target.tagName.toUpperCase()) &&
      target.innerText &&
      target.innerText.trim().length > 10 &&
      target.offsetHeight > 0 &&
      target.offsetWidth > 0 && // Element is visible
      !target.isContentEditable &&
      window.getComputedStyle(target).visibility !== "hidden" &&
      window.getComputedStyle(target).display !== "none" &&
      !target.closest("button, input, textarea, select, a[href], label, summary")
    ) {
      if (lastHoveredElement !== target) {
        hideHoverIcons(); // Hide from previous element if different
        showHoverIcons(target);
      } else {
        clearTimeout(hideHoverIconsTimeout); // Mouse is still over the same element or moved back quickly
      }
    }
  });

  document.addEventListener("mouseout", (event) => {
    if (!hoverButtonsEnabled) return;

    const relatedTarget = event.relatedTarget;
    const toElement = event.toElement;

    // If mouse moves to one of our icons, or from an icon to its parent (the hovered element)
    if ((relatedTarget && (relatedTarget.dataset.tinyMemoIcon || relatedTarget.closest('[data-tiny-memo-icon="true"]'))) || (toElement && (toElement.dataset.tinyMemoIcon || toElement.closest('[data-tiny-memo-icon="true"]')))) {
      clearTimeout(hideHoverIconsTimeout); // Keep icons visible
      return;
    }

    // If the mouse leaves the element that currently has the icons
    if (lastHoveredElement && lastHoveredElement === event.target && !lastHoveredElement.contains(relatedTarget)) {
      scheduleHideHoverIcons();
    }
  });

  // Pre-create selection buttons
  getSelectionMemoButton();
  getSelectionTtsButton();
  // Hover icons are created on demand by getHoverMemoIcon/getHoverTtsIcon and appended/removed dynamically

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

(() => {
  console.log("[Tiny Memo - Inline Button] Handler loaded.");

  let memoButton = null;
  let ttsButton = null;
  const BUTTON_ID = "tiny-memo-inline-button";
  const TTS_BUTTON_ID = "tiny-memo-tts-button";
  let autoTtsEnabled = false;
  let isAutoTtsPlaying = false;

  // 加载自动TTS设置
  chrome.storage.local.get(["autoTtsSetting"], (result) => {
    autoTtsEnabled = result.autoTtsSetting === true;
    console.log("[Tiny Memo - Inline Button] 自动TTS设置已加载:", autoTtsEnabled);
  });

  // 监听存储变化，实时更新设置
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.autoTtsSetting) {
      autoTtsEnabled = changes.autoTtsSetting.newValue === true;
      console.log("[Tiny Memo - Inline Button] 自动TTS设置已更新:", autoTtsEnabled);
    }
  });

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return document.getElementById(BUTTON_ID);

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = "添加到笔记"; // 或者用一个图标
    // 基础样式
    Object.assign(button.style, {
      position: "absolute",
      zIndex: "2147483646", //略低于通知的 z-index
      backgroundColor: "#282c34",
      color: "white",
      border: "1px solid #4CAF50",
      borderRadius: "4px",
      padding: "5px 8px",
      fontSize: "12px",
      cursor: "pointer",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      display: "none", // 默认隐藏
    });

    button.addEventListener("click", async (event) => {
      event.stopPropagation(); // 防止点击事件冒泡到页面
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText) {
        console.log("[Tiny Memo - Inline Button] Button clicked, sending text:", selectedText);
        chrome.runtime.sendMessage({ type: "SELECTION_FROM_CONTENT_SCRIPT", text: selectedText }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Tiny Memo - Inline Button] Error sending message:", chrome.runtime.lastError.message);
            // alert('添加到笔记失败: ' + chrome.runtime.lastError.message);
          } else {
            console.log("[Tiny Memo - Inline Button] Message sent, background responded.");
            // 成功发送后，按钮应该消失
          }
        });
      }
      hideButton(); // 点击后无论如何都隐藏按钮
      hideTtsButton(); // 同时隐藏TTS按钮
    });

    document.body.appendChild(button);
    return button;
  }

  function createTtsButton() {
    if (document.getElementById(TTS_BUTTON_ID)) return document.getElementById(TTS_BUTTON_ID);

    const button = document.createElement("button");
    button.id = TTS_BUTTON_ID;
    button.textContent = "播放语音"; // 或者用一个音频图标
    // TTS按钮样式
    Object.assign(button.style, {
      position: "absolute",
      zIndex: "2147483646",
      backgroundColor: "#282c34",
      color: "white",
      border: "1px solid #4285f4", // 使用蓝色边框区分
      borderRadius: "4px",
      padding: "5px 8px",
      fontSize: "12px",
      cursor: "pointer",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      display: "none", // 默认隐藏
    });

    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText) {
        console.log("[Tiny Memo - TTS Button] Button clicked, requesting TTS for:", selectedText);

        // 显示加载状态
        const originalText = button.textContent;
        button.textContent = "加载中...";
        button.disabled = true;

        // 发送TTS请求给背景脚本
        chrome.runtime.sendMessage({ type: "TTS_REQUEST", text: selectedText }, async (response) => {
          button.disabled = false;
          button.textContent = originalText;

          if (chrome.runtime.lastError) {
            console.error("[Tiny Memo - TTS Button] Error requesting TTS:", chrome.runtime.lastError.message);
            showTtsErrorNotification("TTS请求失败: " + chrome.runtime.lastError.message);
          } else if (response && response.success) {
            console.log("[Tiny Memo - TTS Button] TTS audio URL received:", response.audio_url);

            // 播放音频
            playTtsAudio(response.audio_url);
          } else {
            console.error("[Tiny Memo - TTS Button] TTS request failed:", response?.error);
            showTtsErrorNotification("TTS生成失败: " + (response?.error || "未知错误"));
          }
        });
      }
      // 不要立即隐藏按钮，用户可能想多次播放
    });

    document.body.appendChild(button);
    return button;
  }

  // 播放TTS音频
  function playTtsAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch((error) => {
      console.error("[Tiny Memo - TTS Button] Error playing audio:", error);
      showTtsErrorNotification("音频播放失败");
    });
  }

  // 显示TTS错误通知
  function showTtsErrorNotification(errorMessage) {
    // 防止重复创建
    const existingNotification = document.getElementById("tiny-memo-tts-error");
    if (existingNotification) {
      existingNotification.remove();
    }

    console.log(`[Tiny Memo - TTS Button] Showing error notification: ${errorMessage}`);

    const notificationId = "tiny-memo-tts-error";
    const notification = document.createElement("div");
    notification.id = notificationId;

    // 基本样式
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      backgroundColor: "rgba(220, 53, 69, 0.9)", // 红色背景，表示错误
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

    // 动画显示
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notification.style.opacity = "1";
      });
    });

    // 3秒后自动关闭
    const timeoutId = setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);

    // 鼠标悬停时暂停关闭
    notification.onmouseenter = () => clearTimeout(timeoutId);
    notification.onmouseleave = () => {
      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 1500);
    };
  }

  // 请求TTS并播放音频
  function requestAndPlayTts(text) {
    if (!text || isAutoTtsPlaying) return;

    isAutoTtsPlaying = true;
    console.log("[Tiny Memo - Auto TTS] Requesting TTS for:", text);

    chrome.runtime.sendMessage({ type: "TTS_REQUEST", text: text }, (response) => {
      isAutoTtsPlaying = false;

      if (chrome.runtime.lastError) {
        console.error("[Tiny Memo - Auto TTS] Error requesting TTS:", chrome.runtime.lastError.message);
      } else if (response && response.success) {
        console.log("[Tiny Memo - Auto TTS] TTS audio URL received:", response.audio_url);
        playTtsAudio(response.audio_url);
      } else {
        console.error("[Tiny Memo - Auto TTS] TTS request failed:", response?.error);
      }
    });
  }

  function showButton(x, y) {
    if (!memoButton) memoButton = createButton();
    if (memoButton) {
      // 根据选区位置调整按钮位置
      memoButton.style.left = `${x + 5}px`;
      memoButton.style.top = `${y + window.scrollY - 5}px`;
      memoButton.style.display = "block";
      console.log("[Tiny Memo - Inline Button] Showing button at:", memoButton.style.left, memoButton.style.top);
    }

    // 同时显示TTS按钮，位置在保存按钮右边
    if (!ttsButton) ttsButton = createTtsButton();
    if (ttsButton) {
      const memoWidth = memoButton.getBoundingClientRect().width;
      ttsButton.style.left = `${x + 15 + memoWidth}px`;
      ttsButton.style.top = `${y + window.scrollY - 5}px`;
      ttsButton.style.display = "block";
      console.log("[Tiny Memo - TTS Button] Showing button at:", ttsButton.style.left, ttsButton.style.top);
    }
  }

  function hideButton() {
    if (memoButton) {
      memoButton.style.display = "none";
      console.log("[Tiny Memo - Inline Button] Hiding button.");
    }
  }

  function hideTtsButton() {
    if (ttsButton) {
      ttsButton.style.display = "none";
      console.log("[Tiny Memo - TTS Button] Hiding button.");
    }
  }

  document.addEventListener("mouseup", (event) => {
    // 确保不是点击在我们的按钮上
    if (event.target && (event.target.id === BUTTON_ID || event.target.id === TTS_BUTTON_ID)) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // 显示按钮在选区的右下角
      showButton(rect.right, rect.bottom);

      // 如果启用了自动TTS，则自动朗读选中文本
      if (autoTtsEnabled) {
        requestAndPlayTts(selectedText);
      }
    } else {
      hideButton();
      hideTtsButton();
    }
  });

  // 如果用户点击页面其他地方（非按钮也非新选区），也隐藏按钮
  document.addEventListener(
    "mousedown",
    (event) => {
      if ((memoButton && memoButton.style.display === "block") || (ttsButton && ttsButton.style.display === "block")) {
        if (event.target.id !== BUTTON_ID && event.target.id !== TTS_BUTTON_ID && !memoButton.contains(event.target) && !ttsButton?.contains(event.target)) {
          // 检查点击的是否是选区内的文本，如果是，则不立即隐藏，等待mouseup判断
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || !selection.getRangeAt(0).toString().trim()) {
            hideButton();
            hideTtsButton();
          }
        }
      }
    },
    true
  ); // 使用捕获阶段提前处理

  // 如果选区改变（例如通过键盘），也隐藏按钮
  // 但 selectionchange 触发非常频繁，需要小心处理
  let hideButtonTimeout = null;
  document.addEventListener("selectionchange", () => {
    clearTimeout(hideButtonTimeout);
    hideButtonTimeout = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.getRangeAt(0).toString().trim()) {
        if (document.activeElement && document.activeElement.id !== BUTTON_ID && document.activeElement.id !== TTS_BUTTON_ID) {
          // 确保焦点不在按钮上
          hideButton();
          hideTtsButton();
        }
      }
    }, 150); // 稍微延迟一下，避免过于灵敏
  });

  memoButton = createButton(); // 预先创建按钮，但保持隐藏
  ttsButton = createTtsButton(); // 预先创建TTS按钮，但保持隐藏
})();

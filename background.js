// background.js

// 辅助函数：保存笔记到存储
async function saveNote(text) {
  let noteToSave = text;
  console.log("[Tiny Memo] Original text received for saving:", text);

  try {
    // 获取"合并多行"设置
    const settings = await chrome.storage.local.get(["mergeMultilineSetting"]);
    const shouldMerge = settings.mergeMultilineSetting === undefined ? true : settings.mergeMultilineSetting;
    console.log("[Tiny Memo] Merge multiline setting is:", shouldMerge);

    if (shouldMerge && noteToSave && noteToSave.includes("\n")) {
      console.log("[Tiny Memo] Merging multiline text.");
      noteToSave = noteToSave.replace(/\n+/g, " ").trim();
      console.log("[Tiny Memo] Text after merging:", noteToSave);
    }
  } catch (error) {
    console.error("[Tiny Memo] Error reading mergeMultilineSetting, defaulting to merge:", error);
    // 如果读取设置出错，作为降级处理，也尝试合并（如果文本包含换行符）
    if (noteToSave && noteToSave.includes("\n")) {
      noteToSave = noteToSave.replace(/\n+/g, " ").trim();
    }
  }

  console.log("[Tiny Memo] Attempting to save note:", noteToSave);
  if (noteToSave) {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notes.push(noteToSave);
      await chrome.storage.local.set({ memoNotes: notes });
      console.log("[Tiny Memo] Note saved successfully.");
      return notes.length;
    } catch (error) {
      console.error("[Tiny Memo] Error saving note:", error);
      return null;
    }
  } else {
    return null;
  }
}

// TTS 功能：文本转语音
async function synthesizeSpeech(text) {
  try {
    console.log("[Tiny Memo] Requesting TTS for text:", text);

    // 获取当前的TTS设置
    const settings = await chrome.storage.local.get(["ttsVoice"]);
    const voice = settings.ttsVoice || "zh-CN-XiaoxiaoNeural"; // 默认中文语音

    // 调用本地TTS API
    const response = await fetch("http://localhost:5020/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        voice: voice,
        return_type: "url",
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Tiny Memo] TTS API response:", data);

    if (data.success) {
      return data.audio_url; // 返回音频URL
    } else {
      throw new Error(data.error || "TTS服务返回错误");
    }
  } catch (error) {
    console.error("[Tiny Memo] TTS synthesis error:", error);
    return null;
  }
}

// 获取可用的TTS语音列表
async function getAvailableVoices() {
  try {
    const response = await fetch("http://localhost:5020/api/voices");
    if (!response.ok) {
      throw new Error(`获取语音列表失败: ${response.status}`);
    }
    const voices = await response.json();
    console.log("[Tiny Memo] Available TTS voices:", voices);
    return voices;
  } catch (error) {
    console.error("[Tiny Memo] Error fetching TTS voices:", error);
    return {};
  }
}

// 新增：执行复制并清空操作的核心逻辑
async function performCopyAndClear() {
  try {
    const data = await chrome.storage.local.get(["memoNotes"]);
    const notes = data.memoNotes || [];
    if (notes.length > 0) {
      const markdownNotes = notes.map((note) => `- ${note}`).join("\n");
      // 注意：navigator.clipboard API 在 Service Worker 中不可用
      // 我们需要将文本发送到可以访问剪贴板的地方（如 popup 或 content script）
      // 或者，使用 Offscreen API (Manifest V3 更高级的方式)
      // 暂时，我们先只清空，复制功能在 popup 中保留，通知中触发时也需要特殊处理
      // **更正：为了简化，我们先让通知按钮也只触发清空，或者需要更复杂的实现**

      // **简化方案：暂时让后台只负责清空，复制由触发方（popup/content script）处理**
      // **或者，更好的方案是使用 chrome.scripting.executeScript 注入一个脚本来执行复制**
      await chrome.storage.local.set({ memoNotes: [] });
      console.log("[Tiny Memo] Notes cleared via background request.");
      return { success: true, message: "笔记已清空。" };
      // 返回结果，方便调用方知道操作是否成功
    } else {
      console.log("[Tiny Memo] Copy & Clear requested, but no notes found in storage.");
      return { success: false, message: "没有笔记可以清空。" };
    }
  } catch (error) {
    console.error("[Tiny Memo] Error during copy & clear in background:", error);
    return { success: false, message: "清空笔记时出错。" };
  }
}

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addSelectionToMemo",
    title: "添加到我的简易笔记",
    contexts: ["selection"],
  });
  console.log("[Tiny Memo] Context menu created.");
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("[Tiny Memo] Context menu clicked:", info, "Tab:", tab);
  if (info.menuItemId === "addSelectionToMemo" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    const tabId = tab?.id;
    const newCount = await saveNote(selectedText);
    if (newCount !== null && tabId) {
      console.log(`[Tiny Memo] Note saved via context menu. Total: ${newCount}. Trying to show notification on tab ${tabId}`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: showTinyMemoNotification,
          args: [newCount],
        });
      } catch (error) {
        console.error("[Tiny Memo] Error executing notification script via context menu:", error, "Tab URL:", tab?.url);
        // 在某些页面（如 chrome:// 或文件 URL）上注入脚本可能会失败
      }
    }
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`[Tiny Memo] Command received: ${command}`, "Tab info:", tab);
  if (command === "add-selection-shortcut") {
    if (tab && tab.id) {
      console.log("[Tiny Memo] Executing script for tab ID:", tab.id);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content_script.js"],
        });
        console.log("[Tiny Memo] content_script.js executed for tab:", tab.id);
      } catch (error) {
        console.error("[Tiny Memo] Error executing content_script.js:", error, "Tab URL:", tab.url);
      }
    } else {
      console.warn("[Tiny Memo] Command received but no valid tab ID found. Tab:", tab);
    }
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Tiny Memo] Message received in background:", message, "Sender:", sender);

  if (message.type === "SELECTION_FROM_CONTENT_SCRIPT" && message.text) {
    (async () => {
      const tabId = sender.tab?.id;
      const newCount = await saveNote(message.text);
      if (newCount !== null && tabId) {
        console.log(`[Tiny Memo] Note saved via shortcut. Total: ${newCount}. Trying to show notification on tab ${tabId}`);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: showTinyMemoNotification,
            args: [newCount],
          });
        } catch (error) {
          console.error("[Tiny Memo] Error executing notification script via shortcut:", error, "Tab URL:", sender.tab?.url);
        }
      }
    })();
    return true;
  } else if (message.type === "COPY_AND_CLEAR_REQUEST") {
    (async () => {
      const result = await performCopyAndClear();
      sendResponse(result);
    })();
    return true;
  } else if (message.type === "TTS_REQUEST") {
    // 处理TTS请求
    (async () => {
      try {
        const audioUrl = await synthesizeSpeech(message.text);
        sendResponse({ success: true, audio_url: audioUrl });
      } catch (error) {
        console.error("[Tiny Memo] TTS processing error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  } else if (message.type === "GET_TTS_VOICES") {
    // 获取TTS语音列表
    (async () => {
      try {
        const voices = await getAvailableVoices();
        sendResponse({ success: true, voices: voices });
      } catch (error) {
        console.error("[Tiny Memo] Error fetching TTS voices:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // 可以添加其他消息类型处理
  return false; // 对于未处理的消息或同步处理，返回 false
});

// 定义将在页面中执行的通知函数 (内容来自之前的 show_notification.js)
function showTinyMemoNotification(noteCount) {
  // 防止重复创建
  const existingNotification = document.getElementById("tiny-memo-notification");
  if (existingNotification) {
    // 如果已存在，可以考虑更新内容或重置计时器，但简单起见先移除旧的
    existingNotification.remove();
  }

  console.log(`[Tiny Memo Content] Showing notification. Total notes: ${noteCount}`);

  const notificationId = "tiny-memo-notification";
  const notification = document.createElement("div");
  notification.id = notificationId;

  // 基本样式
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    color: "#FFFFFF",
    padding: "12px 18px",
    borderRadius: "6px",
    zIndex: "2147483647",
    fontFamily: "sans-serif",
    fontSize: "14px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
    opacity: "0",
    transition: "opacity 0.3s ease-in-out",
  });

  const message = document.createElement("span");
  message.textContent = `记录+1，当前共 ${noteCount} 条记录`;
  message.style.whiteSpace = "nowrap";
  notification.appendChild(message);

  const button = document.createElement("button");
  button.textContent = "复制并清空";
  Object.assign(button.style, {
    backgroundColor: "#4CAF50",
    border: "none",
    color: "#FFFFFF",
    padding: "6px 10px",
    textAlign: "center",
    textDecoration: "none",
    display: "inline-block",
    fontSize: "12px",
    borderRadius: "4px",
    cursor: "pointer",
    flexShrink: "0",
  });

  button.onclick = async () => {
    console.log("[Tiny Memo Content] Notification button clicked.");
    try {
      // 1. Copy notes (inside content script context)
      // **We need to get notes from storage first**
      chrome.storage.local.get(["memoNotes"], async (result) => {
        if (chrome.runtime.lastError) {
          console.error("[Tiny Memo Content] Error getting notes for copy:", chrome.runtime.lastError);
          alert("获取笔记以复制时出错。");
          removeNotification(true); // Force remove immediately
          return;
        }
        const notes = result.memoNotes || [];
        if (notes.length > 0) {
          const markdownNotes = notes.map((note) => `- ${note}`).join("\n");
          try {
            await navigator.clipboard.writeText(markdownNotes);
            console.log("[Tiny Memo Content] Notes copied from notification context.");

            // 2. Send clear request to background
            chrome.runtime.sendMessage({ type: "COPY_AND_CLEAR_REQUEST" }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("[Tiny Memo Content] Error sending clear request:", chrome.runtime.lastError);
                alert("清空笔记时出错 (通信失败)");
              } else if (response && response.success) {
                console.log("[Tiny Memo Content] Background confirmed clear.");
                // Maybe show a temporary success message before removing?
              } else {
                alert(response?.message || "清空笔记时发生错误。");
              }
              // Remove notification after action attempt
              removeNotification(true); // Force remove immediately
            });
          } catch (copyError) {
            console.error("[Tiny Memo Content] Error copying notes:", copyError);
            alert("复制笔记到剪贴板失败！");
            removeNotification(true);
          }
        } else {
          alert("没有笔记可以复制。");
          removeNotification(true);
        }
      });
    } catch (error) {
      console.error("[Tiny Memo Content] Unexpected error in button click:", error);
      alert("处理按钮点击时出错。");
      removeNotification(true);
    }
  };
  notification.appendChild(button);

  document.body.appendChild(notification);
  // Animate in (Fade in)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.style.opacity = "1";
    });
  });

  let timeoutId = null;
  const removeNotification = (force = false) => {
    if (timeoutId) clearTimeout(timeoutId);
    const elem = document.getElementById(notificationId);
    if (elem) {
      elem.style.opacity = "0";
      setTimeout(
        () => {
          elem.remove();
        },
        force ? 0 : 300
      );
    }
  };

  timeoutId = setTimeout(removeNotification, 3000);
  notification.onmouseenter = () => clearTimeout(timeoutId);
  notification.onmouseleave = () => {
    timeoutId = setTimeout(removeNotification, 3000);
  };
}

// 用于在页面中播放TTS音频的函数
function playTtsAudio(audioUrl) {
  console.log("[Tiny Memo Content] Playing TTS audio:", audioUrl);

  // 创建音频元素
  const audio = new Audio(audioUrl);

  // 播放音频
  audio.play().catch((error) => {
    console.error("[Tiny Memo Content] Error playing TTS audio:", error);
    // 使用右上角通知替代alert
    showTinyMemoErrorNotification("播放TTS语音失败");
  });
}

// 显示错误通知的函数
function showTinyMemoErrorNotification(errorMessage) {
  // 防止重复创建
  const existingNotification = document.getElementById("tiny-memo-error-notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  console.log(`[Tiny Memo Content] Showing error notification: ${errorMessage}`);

  const notificationId = "tiny-memo-error-notification";
  const notification = document.createElement("div");
  notification.id = notificationId;

  // 基本样式
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    backgroundColor: "rgba(220, 53, 69, 0.9)", // 红色背景，表示错误
    color: "#FFFFFF",
    padding: "12px 18px",
    borderRadius: "6px",
    zIndex: "2147483647",
    fontFamily: "sans-serif",
    fontSize: "14px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
    opacity: "0",
    transition: "opacity 0.3s ease-in-out",
    maxWidth: "300px",
  });

  const message = document.createElement("span");
  message.textContent = errorMessage;
  message.style.whiteSpace = "normal"; // 允许文本换行
  notification.appendChild(message);

  document.body.appendChild(notification);
  // Animate in (Fade in)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.style.opacity = "1";
    });
  });

  // 自动关闭通知
  const timeoutId = setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);

  // 鼠标悬停时暂停关闭计时
  notification.onmouseenter = () => clearTimeout(timeoutId);
  notification.onmouseleave = () => {
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  };
}

console.log("[Tiny Memo] background.js loaded and running.");

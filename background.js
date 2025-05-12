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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "white",
    padding: "15px 20px",
    borderRadius: "8px",
    zIndex: "2147483647",
    fontFamily: "sans-serif",
    fontSize: "14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    opacity: "0",
    transition: "opacity 0.5s ease-in-out, transform 0.5s ease-in-out",
    transform: "translateX(100%)", // Start off-screen
  });

  const message = document.createElement("span");
  message.textContent = `记录+1，当前共 ${noteCount} 条记录`;
  notification.appendChild(message);

  const button = document.createElement("button");
  button.textContent = "复制并清空记录";
  Object.assign(button.style, {
    backgroundColor: "#4CAF50",
    border: "none",
    color: "white",
    padding: "8px 12px",
    textAlign: "center",
    textDecoration: "none",
    display: "inline-block",
    fontSize: "12px",
    borderRadius: "4px",
    cursor: "pointer",
    alignSelf: "flex-end",
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
  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Double requestAnimationFrame for reliability
      notification.style.opacity = "1";
      notification.style.transform = "translateX(0)";
    });
  });

  let timeoutId = null;
  const removeNotification = (force = false) => {
    if (timeoutId) clearTimeout(timeoutId);
    const elem = document.getElementById(notificationId);
    if (elem) {
      elem.style.opacity = "0";
      elem.style.transform = "translateX(100%)";
      setTimeout(
        () => {
          elem.remove();
        },
        force ? 0 : 500
      ); // Remove immediately if forced
    }
  };

  timeoutId = setTimeout(removeNotification, 3000);
  notification.onmouseenter = () => clearTimeout(timeoutId);
  notification.onmouseleave = () => {
    timeoutId = setTimeout(removeNotification, 3000);
  };
}

console.log("[Tiny Memo] background.js loaded and running.");

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
    // 确保 noteToSave 在处理后仍然有内容
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notes.push(noteToSave);
      await chrome.storage.local.set({ memoNotes: notes });
      console.log("[Tiny Memo] Note saved successfully.");
    } catch (error) {
      console.error("[Tiny Memo] Error saving note:", error);
    }
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
  console.log("[Tiny Memo] Context menu clicked:", info);
  if (info.menuItemId === "addSelectionToMemo" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    await saveNote(selectedText);
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

// 监听从内容脚本发送过来的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Tiny Memo] Message received from content script:", message, "Sender:", sender);
  if (message.type === "SELECTION_FROM_CONTENT_SCRIPT" && message.text) {
    (async () => {
      await saveNote(message.text);
      // sendResponse({ status: "success", message: "笔记已保存" }); // 可选
    })();
    // return true; // 如果需要异步发送响应
  }
});

console.log("[Tiny Memo] background.js loaded and running.");

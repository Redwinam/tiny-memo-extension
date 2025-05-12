// background.js

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addSelectionToMemo",
    title: "添加到我的简易笔记", // 右键菜单显示的文字
    contexts: ["selection"], // 只在有文本选中时显示
  });
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addSelectionToMemo" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (selectedText) {
      try {
        // 从存储中获取当前笔记
        const data = await chrome.storage.local.get(["memoNotes"]);
        const notes = data.memoNotes || [];
        notes.push(selectedText); // 追加新笔记
        // 保存更新后的笔记
        await chrome.storage.local.set({ memoNotes: notes });
        // （可选）可以通过发送消息给内容脚本或弹窗来提示用户添加成功
      } catch (error) {
        console.error("保存笔记失败:", error);
      }
    }
  }
});

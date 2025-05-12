// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const notesDisplay = document.getElementById("notesDisplay");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const clearNotesBtn = document.getElementById("clearNotesBtn");
  const mergeMultilineCheckbox = document.getElementById("mergeMultilineCheckbox");

  // 加载"合并多行"设置
  async function loadMergeSetting() {
    try {
      const data = await chrome.storage.local.get(["mergeMultilineSetting"]);
      // 默认开启，所以如果未定义，则设为 true
      mergeMultilineCheckbox.checked = data.mergeMultilineSetting === undefined ? true : data.mergeMultilineSetting;
    } catch (error) {
      console.error("[Tiny Memo] 加载合并设置失败:", error);
      mergeMultilineCheckbox.checked = true; // 出错时也默认开启
    }
  }

  // 保存"合并多行"设置
  mergeMultilineCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ mergeMultilineSetting: mergeMultilineCheckbox.checked });
      console.log("[Tiny Memo] 合并设置已保存:", mergeMultilineCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存合并设置失败:", error);
    }
  });

  async function loadNotes() {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notesDisplay.value = notes.join("\n");
      console.log("[Tiny Memo] Notes loaded into popup display.");
    } catch (error) {
      console.error("[Tiny Memo] 加载笔记失败:", error);
      notesDisplay.value = "加载笔记出错。";
    }
  }

  copyMarkdownBtn.addEventListener("click", async () => {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      if (notes.length === 0) {
        alert("没有笔记可以复制。");
        return;
      }
      const markdownNotes = notes.map((note) => `- ${note}`).join("\n");
      await navigator.clipboard.writeText(markdownNotes);
      copyMarkdownBtn.textContent = "已复制!";
      setTimeout(() => {
        copyMarkdownBtn.textContent = "复制为 Markdown";
      }, 2000);
    } catch (error) {
      console.error("[Tiny Memo] 复制笔记失败:", error);
      alert("复制失败！");
    }
  });

  // "复制并清空笔记" 按钮的逻辑
  clearNotesBtn.addEventListener("click", async () => {
    const currentNotesValue = notesDisplay.value;

    if (currentNotesValue === "") {
      console.log("[Tiny Memo] Copy & Clear button clicked, but no notes in display.");
      alert("没有笔记可以操作。");
      return;
    }

    try {
      // 1. 先执行复制操作 (在 popup 中完成)
      const notesToCopy = currentNotesValue
        .split("\n")
        .map((note) => `- ${note}`)
        .join("\n");
      await navigator.clipboard.writeText(notesToCopy);
      console.log("[Tiny Memo] Notes copied to clipboard from popup.");

      // 2. 发送消息给 background 请求清空
      console.log("[Tiny Memo] Sending request to background to clear notes.");
      const response = await chrome.runtime.sendMessage({ type: "COPY_AND_CLEAR_REQUEST" });

      // 3. 处理 background 的响应
      if (response && response.success) {
        notesDisplay.value = ""; // 响应成功后清空显示区域
        console.log("[Tiny Memo] Background confirmed notes cleared.");
        alert("笔记已复制并清空。"); // 使用后台返回的消息或固定文本
      } else {
        console.error("[Tiny Memo] Background script failed to clear notes:", response?.message);
        alert(response?.message || "清空笔记时发生错误。");
      }
    } catch (error) {
      console.error("[Tiny Memo] Error during copy & clear in popup:", error);
      if (error.message.includes("clipboard.writeText")) {
        alert("复制笔记失败！请检查剪贴板权限。");
      } else {
        alert("操作失败！请重试。");
      }
    }
  });

  loadNotes(); // 弹窗加载时即显示笔记
  loadMergeSetting(); // 加载合并设置

  // (可选) 监听存储变化，实时更新弹窗内容
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.memoNotes) {
        console.log("[Tiny Memo] memoNotes changed in storage, reloading notes in popup.", changes.memoNotes);
        loadNotes();
      }
      if (changes.mergeMultilineSetting) {
        console.log("[Tiny Memo] mergeMultilineSetting changed in storage, reloading setting in popup.", changes.mergeMultilineSetting);
        loadMergeSetting();
      }
    }
  });
});

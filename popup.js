// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const notesDisplay = document.getElementById("notesDisplay");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const clearNotesBtn = document.getElementById("clearNotesBtn");
  const mergeMultilineCheckbox = document.getElementById("mergeMultilineCheckbox");
  const ttsVoiceSelect = document.getElementById("ttsVoiceSelect");
  const autoTtsCheckbox = document.getElementById("autoTtsCheckbox");
  const hoverButtonsCheckbox = document.getElementById("hoverButtonsCheckbox");

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

  // 加载"自动TTS"设置
  async function loadAutoTtsSetting() {
    try {
      const data = await chrome.storage.local.get(["autoTtsSetting"]);
      // 默认关闭，所以如果未定义，则设为 false
      autoTtsCheckbox.checked = data.autoTtsSetting === true;
      console.log("[Tiny Memo] 自动TTS设置已加载:", autoTtsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 加载自动TTS设置失败:", error);
      autoTtsCheckbox.checked = false; // 出错时默认关闭
    }
  }

  // 保存"自动TTS"设置
  autoTtsCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ autoTtsSetting: autoTtsCheckbox.checked });
      console.log("[Tiny Memo] 自动TTS设置已保存:", autoTtsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存自动TTS设置失败:", error);
    }
  });

  // 加载"鼠标悬停按钮"设置
  async function loadHoverButtonsSetting() {
    try {
      const data = await chrome.storage.local.get(["hoverButtonsSetting"]);
      // 默认关闭
      hoverButtonsCheckbox.checked = data.hoverButtonsSetting === true;
      console.log("[Tiny Memo] 悬停按钮设置已加载:", hoverButtonsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 加载悬停按钮设置失败:", error);
      hoverButtonsCheckbox.checked = false; // 出错时默认关闭
    }
  }

  // 保存"鼠标悬停按钮"设置
  hoverButtonsCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ hoverButtonsSetting: hoverButtonsCheckbox.checked });
      console.log("[Tiny Memo] 悬停按钮设置已保存:", hoverButtonsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存悬停按钮设置失败:", error);
    }
  });

  // 加载TTS语音选项
  async function loadTtsVoices() {
    try {
      // 先加载当前选择的语音
      const settings = await chrome.storage.local.get(["ttsVoice"]);
      const currentVoice = settings.ttsVoice || "zh-CN-XiaoxiaoNeural"; // 默认中文语音

      // 从背景脚本获取语音列表
      chrome.runtime.sendMessage({ type: "GET_TTS_VOICES" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Tiny Memo] 获取TTS语音列表失败:", chrome.runtime.lastError);
          return;
        }

        if (response && response.success && response.voices) {
          populateVoiceSelect(response.voices, currentVoice);
        } else {
          console.error("[Tiny Memo] 获取TTS语音列表响应错误:", response?.error);
        }
      });
    } catch (error) {
      console.error("[Tiny Memo] 加载TTS语音设置失败:", error);
    }
  }

  // 填充语音选择下拉菜单
  function populateVoiceSelect(voices, currentVoice) {
    // 清空现有选项
    ttsVoiceSelect.innerHTML = "";

    // 常用语言（优先显示）
    const commonLanguages = ["zh", "en", "ja"];
    const languageNames = {
      zh: "中文",
      en: "英语",
      ja: "日语",
      ko: "韩语",
      fr: "法语",
      de: "德语",
      es: "西班牙语",
    };

    // 如果voices不是按语言分组的，则创建一个简单列表
    if (!voices.zh && Array.isArray(voices)) {
      voices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name || voice;
        option.text = voice.displayName || voice.name || voice;
        if (voice.name === currentVoice || voice === currentVoice) {
          option.selected = true;
        }
        ttsVoiceSelect.appendChild(option);
      });
      return;
    }

    // 按语言分组添加语音选项
    // 先添加常用语言
    commonLanguages.forEach((lang) => {
      if (voices[lang] && voices[lang].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = languageNames[lang] || lang;

        voices[lang].forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.text = voice.displayName || `${voice.name}`;
          if (voice.name === currentVoice) {
            option.selected = true;
          }
          optgroup.appendChild(option);
        });

        ttsVoiceSelect.appendChild(optgroup);
      }
    });

    // 添加其他语言
    Object.keys(voices).forEach((lang) => {
      if (!commonLanguages.includes(lang) && voices[lang] && voices[lang].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = languageNames[lang] || lang;

        voices[lang].forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.text = voice.displayName || `${voice.name}`;
          if (voice.name === currentVoice) {
            option.selected = true;
          }
          optgroup.appendChild(option);
        });

        ttsVoiceSelect.appendChild(optgroup);
      }
    });
  }

  // 保存TTS语音设置
  ttsVoiceSelect.addEventListener("change", async () => {
    const selectedVoice = ttsVoiceSelect.value;
    if (selectedVoice) {
      try {
        await chrome.storage.local.set({ ttsVoice: selectedVoice });
        console.log("[Tiny Memo] TTS语音设置已保存:", selectedVoice);
      } catch (error) {
        console.error("[Tiny Memo] 保存TTS语音设置失败:", error);
      }
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
  loadTtsVoices(); // 加载TTS语音选项
  loadAutoTtsSetting(); // 加载自动TTS设置
  loadHoverButtonsSetting(); // 加载悬停按钮设置

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
      if (changes.ttsVoice) {
        console.log("[Tiny Memo] ttsVoice changed in storage, reloading setting in popup.", changes.ttsVoice);
        // 只需更新下拉框选中值，无需重新加载所有语音
        if (ttsVoiceSelect.value !== changes.ttsVoice.newValue) {
          const options = Array.from(ttsVoiceSelect.options);
          const matching = options.find((opt) => opt.value === changes.ttsVoice.newValue);
          if (matching) {
            matching.selected = true;
          }
        }
      }
      if (changes.autoTtsSetting) {
        console.log("[Tiny Memo] autoTtsSetting changed in storage, reloading setting in popup.", changes.autoTtsSetting);
        autoTtsCheckbox.checked = changes.autoTtsSetting.newValue === true;
      }
      if (changes.hoverButtonsSetting) {
        console.log("[Tiny Memo] hoverButtonsSetting changed in storage, reloading setting in popup.", changes.hoverButtonsSetting);
        hoverButtonsCheckbox.checked = changes.hoverButtonsSetting.newValue === true;
      }
    }
  });
});

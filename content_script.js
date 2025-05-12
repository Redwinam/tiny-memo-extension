// content_script.js

// 尝试获取当前页面选中的文本
const selection = window.getSelection().toString().trim();

// 如果确实有选中的文本，则将其发送给后台脚本
if (selection) {
  chrome.runtime.sendMessage({ type: "SELECTION_FROM_CONTENT_SCRIPT", text: selection }, (response) => {
    if (chrome.runtime.lastError) {
      // 如果发送失败，可以记录错误，但通常不需要在这里打扰用户
      // console.warn('Error sending selection to background:', chrome.runtime.lastError.message);
    }
    // 可以在这里处理后台脚本的响应，但对于此功能，我们主要关注发送
  });
}

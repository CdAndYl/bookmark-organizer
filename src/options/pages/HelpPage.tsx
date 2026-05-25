export function HelpPage() {
  return (
    <div className="help-page">
      <section>
        <h2>使用流程</h2>
        <ol>
          <li>在「整理」页查看预览树,确认即将生成的分类结构。</li>
          <li>点击「开始整理」,二次确认后执行。整理前会自动备份。</li>
          <li>如需调整分类,前往「规则」页编辑分类目录、关键词、权重,然后回到「整理」页重新预览。</li>
          <li>若整理结果不理想,前往「整理」页底部的「备份历史」选择一份恢复。</li>
        </ol>
      </section>

      <section>
        <h2>数据隐私</h2>
        <ul>
          <li>所有数据保存在本地 Chrome 存储中,不会上传到任何服务器。</li>
          <li>启用 AI 时,仅发送 <b>标题 / 域名 / 原文件夹路径 / 去掉 query 的 URL</b> 给你配置的接口。</li>
          <li>API Key 仅写入 chrome.storage.local。卸载扩展即清除。</li>
        </ul>
      </section>

      <section>
        <h2>规则导入导出</h2>
        <p>
          「规则」页支持将完整规则集导出为 JSON 文件,也支持导入其他人分享的规则集。
          导入会覆盖当前规则,可通过「重置为默认」回到内置规则。
        </p>
      </section>
    </div>
  );
}

function App() {
  return (
    <main className="app-shell">
      <section className="intro-panel" aria-labelledby="app-title">
        <div className="brand-mark" aria-hidden="true">
          M
        </div>
        <div>
          <h1 id="app-title">MapX</h1>
          <p>面向中国用户的跨平台地图项目工作台。</p>
        </div>
      </section>

      <section className="status-panel" aria-label="当前工程状态">
        <h2>V1 Foundation</h2>
        <p>Tauri + React + TypeScript 空壳已就绪，下一步会接入应用元数据、UI 基座和本地数据层。</p>
        <a href="https://github.com/QinshanSun/mapx/issues/1" target="_blank" rel="noreferrer">
          查看 FND-001
        </a>
      </section>
    </main>
  );
}

export default App;

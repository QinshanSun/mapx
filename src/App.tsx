import {
  CircleHelp,
  FolderOpen,
  MapPinned,
  Search,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspaceActionEvents } from "@/hooks/use-workspace-action-events";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WorkspaceMarkerPreview, WorkspacePanel } from "@/types/workspace";

const markerPreviews: WorkspaceMarkerPreview[] = [
  {
    id: "mk-001",
    name: "上海静安项目点",
    categoryName: "现场点位",
    city: "上海",
    address: "静安区南京西路附近",
  },
  {
    id: "mk-002",
    name: "杭州样板仓",
    categoryName: "收藏点",
    city: "杭州",
    address: "余杭区未来科技城",
  },
];

const navItems: Array<{ panel: WorkspacePanel; label: string; icon: LucideIcon }> = [
  { panel: "overview", label: "项目概览", icon: FolderOpen },
  { panel: "markers", label: "点位管理", icon: MapPinned },
  { panel: "settings", label: "设置", icon: Settings },
  { panel: "about", label: "关于", icon: CircleHelp },
];

function getDetailTitle(panel: WorkspacePanel) {
  switch (panel) {
    case "markers":
      return "点位详情";
    case "settings":
      return "设置入口";
    case "about":
      return "关于信息";
    case "overview":
      return "项目概览";
  }
}

function App() {
  useWorkspaceActionEvents();

  const { activePanel, dispatchAction, lastActionNotice, selectedMarkerId, setActivePanel, selectMarker } =
    useWorkspaceStore();
  const selectedMarker = markerPreviews.find((marker) => marker.id === selectedMarkerId) ?? markerPreviews[0];
  const detailTitle = getDetailTitle(activePanel);

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              MX
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-6">MapX</h1>
              <p className="text-xs text-muted-foreground">项目制地图管理</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.panel;

            return (
              <Button
                key={item.panel}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setActivePanel(item.panel)}
              >
                <Icon />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 text-xs leading-5 text-muted-foreground">
          <p>默认城市：上海</p>
          <p>百度 AK：待配置</p>
          <p>快捷键：Cmd/Ctrl+N/F/S、Esc、Delete</p>
        </div>
      </aside>

      <section className="grid min-w-0 flex-1 grid-cols-[minmax(420px,1fr)_340px]">
        <section className="flex min-w-0 flex-col bg-slate-50">
          <header className="flex h-16 items-center justify-between border-b border-border bg-white px-5">
            <div>
              <p className="text-xs text-muted-foreground">当前项目</p>
              <h2 className="text-base font-semibold">默认项目</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => dispatchAction("search.focus", "button")}>
                <Search />
                搜索
              </Button>
              <Button size="sm" onClick={() => dispatchAction("project.new", "button")}>
                <FolderOpen />
                新建项目
              </Button>
            </div>
          </header>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
            <div className="absolute inset-0 map-grid" aria-hidden="true" />
            <div className="relative z-10 w-full max-w-2xl rounded-lg border border-dashed border-slate-300 bg-white/88 p-8 text-center shadow-sm backdrop-blur">
              <MapPinned className="mx-auto mb-4 size-9 text-emerald-600" />
              <h3 className="text-lg font-semibold">地图画布占位</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                后续地图集成任务会在这里接入百度底图、点位渲染和点位创建工具模式。
              </p>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-border bg-white">
          <header className="border-b border-border p-5">
            <p className="text-xs text-muted-foreground">右侧详情</p>
            <h2 className="mt-1 text-base font-semibold">{detailTitle}</h2>
          </header>

          <div className="space-y-4 p-5">
            <section className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">快速操作</h3>
                <Star className="size-4 text-amber-500" />
              </div>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => dispatchAction("view.settings", "button")}
                >
                  <Settings />
                  打开设置
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => dispatchAction("help.about", "button")}
                >
                  <CircleHelp />
                  关于 MapX
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-slate-50 p-4 text-sm leading-6">
              <h3 className="mb-2 font-semibold">最近动作</h3>
              {lastActionNotice ? (
                <div>
                  <p className="font-medium">{lastActionNotice.label}</p>
                  <p className="text-muted-foreground">{lastActionNotice.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">来源：{lastActionNotice.source}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">菜单和快捷键触发后会在这里显示占位状态。</p>
              )}
            </section>

            <section className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">点位预览</h3>
              <div className="space-y-2">
                {markerPreviews.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    className="w-full rounded-md border border-border p-3 text-left text-sm transition hover:border-primary/40 hover:bg-accent"
                    onClick={() => selectMarker(marker.id)}
                  >
                    <span className="font-medium">{marker.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {marker.categoryName} · {marker.city}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border p-4 text-sm leading-6">
              <h3 className="mb-2 font-semibold">{selectedMarker.name}</h3>
              <p className="text-muted-foreground">{selectedMarker.address}</p>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;

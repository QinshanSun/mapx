import { Check, Download, ExternalLink, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildUpdateStatusViewModel } from "@/services/update-state";
import type { AppUpdateState } from "@/types/update";

interface UpdateDialogProps {
  state: AppUpdateState;
  isOpen: boolean;
  onClose: () => void;
  onDownloadUpdate: () => void;
  onRestartToInstallUpdate: () => void;
  onOpenDownloadPage: () => void;
}

export function UpdateDialog({
  state,
  isOpen,
  onClose,
  onDownloadUpdate,
  onRestartToInstallUpdate,
  onOpenDownloadPage,
}: UpdateDialogProps) {
  if (!isOpen || (state.status !== "available" && state.status !== "downloading" && state.status !== "waiting-for-restart" && state.status !== "failed")) {
    return null;
  }

  const viewModel = buildUpdateStatusViewModel(state);
  const isDownloading = state.status === "downloading";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">应用更新</p>
            <h2 id="update-dialog-title" className="mt-1 text-lg font-semibold">
              {viewModel.title}
            </h2>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="稍后处理更新" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
          <p>{viewModel.detail}</p>
          {state.update ? <p className="mt-2">当前版本：{state.update.currentVersion}</p> : null}
          {state.update?.publishedAt ? <p>发布时间：{state.update.publishedAt}</p> : null}
        </div>

        {isDownloading ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary" style={{ width: `${state.progress?.percent ?? 20}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">下载过程中不会自动重启。</p>
          </div>
        ) : null}

        {state.status === "failed" ? <p className="mt-3 text-sm leading-6 text-red-600">{state.error.message}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenDownloadPage}>
            <ExternalLink />
            下载页面
          </Button>
          {state.status === "available" ? (
            <Button type="button" size="sm" onClick={onDownloadUpdate}>
              <Download />
              立即更新
            </Button>
          ) : null}
          {state.status === "downloading" ? (
            <Button type="button" size="sm" disabled>
              <RefreshCw />
              下载中
            </Button>
          ) : null}
          {state.status === "waiting-for-restart" ? (
            <Button type="button" size="sm" onClick={onRestartToInstallUpdate}>
              <Check />
              重启安装
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

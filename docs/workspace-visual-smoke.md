# Workspace Visual Smoke Checklist

Use this checklist before closing workspace UX issues or cutting an unsigned V1 test release. It is intentionally small: it checks user-visible state semantics and control reachability without becoming a pixel-perfect visual regression suite.

## Required States

- 项目概览：未选中点位、无 pending 点位、无百度 POI 预览时，右侧标题显示“项目概览”，内容不显示点位详情 fallback。
- 点位详情：从点位列表或地图 marker 选中点位后，右侧标题显示“点位详情”，内容显示该点位名称、地址、分类、标签和坐标。
- 编辑点位：点击编辑后，右侧标题显示“编辑点位”，地图 marker 可拖动，拖动后保存/取消入口可见。
- 新建点位：进入添加点位工具模式并点击地图后，右侧标题显示“新建点位”，地图状态提示说明这是待保存点位。
- 百度地点预览：搜索百度 POI 并预览结果后，右侧标题显示“百度地点预览”，保存为点位入口可见。
- 地图控件：普通/卫星位于地图左上，添加点位/中心点/定位位于地图右上，缩放位于地图右侧，提示文案不挤压按钮。
- 地图不可用/定位失败：地图失败状态显示重试、设置、打开日志目录；定位失败提示包含“可继续手动操作地图”。

## Pass Criteria

- 以上状态没有明显重叠、截断或不可读文本。
- 主要按钮可通过鼠标点击和键盘 Tab 到达。
- 删除确认使用应用内对话框，并包含明确标题。
- 黄色或警告提示在默认屏幕上清晰可读。
- 检查结果记录到对应 GitHub issue closing comment。

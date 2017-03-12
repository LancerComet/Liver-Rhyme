# Liver Rhyme

## 简介

从音频文件中粗略提取音乐节拍与 BPM.

生成两个 `AudioContext`，一个作为播放上下文，一个作为分析上下文.
将传入的音频文件转换为 `AudioBuffer` 送入这两个上下文中.

播放上下文纯播放用途，无其他功能.
`SourceNode -> ScriptNode -> Destination.`
 
分析上下文接入多个节点以分析节拍：
`SourceNode -> Low-Pass Filter -> High-Pass Filter -> Destination.`

分析上下文为 `OfflineAudioContext` 类型.

这是一个很山寨，很简陋的分析，所以使用低通过滤器来提取低频鼓点是一个比较简单且容易实现的方式.
经过以上节点得出 `renderedAudioBuffer`，获取其中的声道数据后送入 `getPeaks` 函数中提取出峰值音量所在的 `position`（采样点位置）.

然后在播放过程中获取当前的时间轴，匹配峰值位即可.
 
之后，可将获得的 `peaks` 放入 `getPeakIntervals` 函数中获取 `peak` 之间的间隔统计，从而得出 `bpm` 统计值.

## Reference
[Beat Detection Using JavaScript and the Web Audio API](http://joesul.li/van/beat-detection-using-web-audio/)

/*
 *  Get beats from an audio file By LancerComet at 1:03, 2017/3/11.
 *  # Carry Your World #
 *  ---
 *  从音频文件中大体提取音乐节拍.
 *
 *  生成两个 AudioContext，一个作为播放上下文，一个作为分析上下文.
 *  将传入的音频文件转换为 AudioBuffer 送入这两个上下文中.
 *
 *  播放上下文纯播放用途，无其他功能.
 *  SourceNode -> ScriptNode -> Destination.
 * 
 *  分析上下文接入多个节点以分析节拍：
 *  SourceNode -> Low-Pass Filter -> High-Pass Filter -> Destination.
 *
 *  分析上下文为 OfflineAudioContext 类型.
 *
 *  这是一个很山寨，很简陋的分析，所以使用低通过滤器来提取低频鼓点是一个比较简单且容易实现的方式.
 *  经过以上节点得出 renderedAudioBuffer，获取其中的声道数据后送入 getPeaks 函数中提取出峰值音量所在的 position（采样点位置）.
 *
 *  然后在播放过程中获取当前的时间轴，匹配峰值位即可.
 */

class LiverRhyme {
  constructor (audioSelector = '', config = {}) {
    this.initAudioSelector(audioSelector)

    this.config = config  // 配置.

    this.file = null  // 音频文件.
    this.fileName = null  // 音频文件名称.
    this.audioBuffer = null  // 音频文件的 audioBuffer.
    this.audioSampleRate = null  // 音频文件的采样率.

    this.peaks = []  // 峰值信息.
  }

  /**
   * 创建分析用 AudioContext.
   * 类型为 OfflineAudioContext.
   *
   * @param channel
   * @param seconds
   * @param sampleRate
   */
  createAnalyseContext (channel = 2, seconds, sampleRate = 44100) {
    // 省道数，长度，采样率.
    // 音频长度为采样率 x 秒数.
    this.analyseContext = new window.OfflineAudioContext(channel, sampleRate * seconds, sampleRate)
  }

  /**
   * 创建播放用 AudioContext.
   */
  createPlaybackContext () {
    this.playbackContext = new window.AudioContext()
  }

  /**
   * 初始化文件选择器.
   * @param {string} selector 节点选择器.
   */
  initAudioSelector (selector = '') {
    if (!selector) {
      throw new Error('[Error] Please provide valid selector when calling LiverRhyme.initAudioSelector().')
    }
    const fileInput = document.querySelector(selector)
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length === 0) { return }
      this.file = fileInput.files[0]
      this.fileName = this.file.name
      this.onAudioFileSelected()
    })
  }

  /**
   * 文件选择后初始化逻辑.
   */
  onAudioFileSelected () {
    const fileReader = new FileReader()

    fileReader.addEventListener('load', event => {
      const audioArrayBuffer = event.target.result

      // 创建播放上下文.
      this.createPlaybackContext()

      // 读取信息至 play 上下文.
      this.playbackContext.decodeAudioData(audioArrayBuffer, audioBuffer => {
        // 保存采样率.
        this.audioSampleRate = audioBuffer.sampleRate

        // 拿到采样率后创建 offline 类型的 analyse 节点.
        this.createAnalyseContext(2, audioBuffer.duration, this.audioSampleRate)

        // 初始化 play 与 analysis 上下文.
        this.initPlayContext(this.playbackContext, audioBuffer)
        this.initAnalysisContext(this.analyseContext, audioBuffer)
      }, error => {
        throw new Error('[Error] Audio file read failure: ', error)
      })
    })

    // Read audio file.
    fileReader.readAsArrayBuffer(this.file)
  }

  /**
   * BPM 分析.
   *
   * @param audioContext
   * @param audioBuffer
   */
  initAnalysisContext (audioContext, audioBuffer) {
    // AudioContext 能创建各种 Audio 节点.
    // 通过 AudioContext 可以创建不同各类的 AudioNode，即音频节点，不同节点作用不同，
    // 有的对音频加上滤镜比如提高音色(比如 BiquadFilterNode)，改变单调，
    // 有的音频进行分割，比如将音源中的声道分割出来得到左右声道的声音（ChannelSplitterNode），
    // 有的对音频数据进行频谱分析 (AnalyserNode).
    // 有的对数据进行处理（ScriptNode）

    // 节点传递方向:
    // sourceNode -> low-pass-filter -> high-pass-filter -> destination.

    // 创建 sourceNode.
    const sourceNode = audioContext.createBufferSource()
    sourceNode.buffer = audioBuffer

    // 使用低通过滤器进行分析.
    // 简单粗暴的方式，但能初步实现效果.
    const lowPass = audioContext.createBiquadFilter()
    lowPass.type = 'lowpass'

    // 创建一个 High-Pass.
    const highPass = audioContext.createBiquadFilter()
    highPass.type = 'highpass'
    // highPass.frequency.value = 100
    // highPass.Q.value = 1

    // 接入 analyser.
    const analyser = audioContext.createAnalyser()

    sourceNode.connect(lowPass)
    lowPass.connect(highPass)
    highPass.connect(analyser)
    analyser.connect(audioContext.destination)

    sourceNode.start(0)

    audioContext.startRendering().then(renderedAudioBuffer => {
      this.peaks = getPeaks([renderedAudioBuffer.getChannelData(0), renderedAudioBuffer.getChannelData(1)], this.audioSampleRate)
      // const peakIntervals = getPeakIntervals(peaks)
      // console.log(peakIntervals)

      if (this.config.autoPlay) {
        this.play()
      }
    })

    // offlineAudioContext 渲染出成品 audioBuffer 后需要放入新的 AudioContext 播放.
    // audioContext.startRendering().then(renderedBuffer => {
    //   const peaks = getPeaks([renderedBuffer.getChannelData(0), renderedBuffer.getChannelData(1)])
    //   console.log(peaks)
    //   const peakIntervals = getPeakIntervals(peaks)
    //   console.log(peakIntervals)
    //
    //   if (this.config.autoPlay) {
    //     LiverRhyme.play(renderedBuffer)
    //   }
    // })
  }

  /**
   * 初始化播放上下文.
   */
  initPlayContext (playingContext, audioBuffer) {
    const isBeatNode = document.querySelector('#is-beat')

    const sourceNode = playingContext.createBufferSource()
    sourceNode.buffer = audioBuffer

    // 创建 scriptNode 来控制和分析音频.
    /*
       bufferSize
       ---
       缓冲区大小，以样本帧为单位。具体来讲，缓冲区大小必须去是下面这些值当中的某一个: 256, 512, 1024, 2048, 4096, 8192, 16384. 如果不传，或者参数为0，则取当前环境最合适的缓冲区大小, 取值为2的幂次方的一个常数，在该node的整个生命周期中都不变.
       该取值控制着audioprocess事件被分派的频率，以及每一次调用多少样本帧被处理. 较低bufferSzie将导致一定的延迟。较高的bufferSzie就要注意避免音频的崩溃和故障。推荐作者不要给定具体的缓冲区大小，让系统自己选一个好的值来平衡延迟和音频质量。

       numberOfInputChannels
       ---
       值为整数，用于指定输入node的声道的数量，默认值是2，最高能取32.

       numberOfOutputChannels
       ---
       值为整数，用于指定输出node的声道的数量，默认值是2，最高能取32.
     */
    const scriptNode = playingContext.createScriptProcessor()
    scriptNode.onaudioprocess = event => {
      const playbackTime = Math.floor(event.timeStamp) / 1000  // 当前播放时间（秒），向下取整.

      // 计算出当前的位置: playbackTime * sampleRate
      const currentPosition = playbackTime * this.audioSampleRate

      // 从 peaks 中查找是否有峰值采样点和当前采样点相差设定毫秒内间距.
      // 如果是则认为是节拍位.
      // 当前我取值为 100 ms.
      const CHECK_DEVIATION = 10
      if (this.peaks.filter(item => Math.abs(item.position - currentPosition) < (this.audioSampleRate / 1000 * CHECK_DEVIATION)).length) {
        console.log(true)
        isBeatNode.innerHTML = true
        isBeatNode.style.color = 'green'
      } else {
        console.log(false)
        isBeatNode.innerHTML = false
        isBeatNode.style.color = 'red'
      }

      // 将数据从 inputBuffer 放入至 outputBuffer.
      const inputBuffer = event.inputBuffer
      const outputBuffer = event.outputBuffer

      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const inputData = inputBuffer.getChannelData(channel)
        const outputData = outputBuffer.getChannelData(channel)

        for (let sample = 0, length = inputBuffer.length; sample < length; sample++) {
          outputData[sample] = inputData[sample]
        }
      }
    }

    sourceNode.connect(scriptNode)
    scriptNode.connect(playingContext.destination)
    this.playSourceNode = sourceNode
  }

  /**
   * 播放音频.
   */
  play () {
    this.playSourceNode.start(0)
    console.log('Play.')
  }
}

const newAudio = new LiverRhyme('#audio-selector', {
  autoPlay: true
})


/**
 * 从声道数据中获取峰值.
 *
 * @param {Array<Float32Array>} channelData 从 renderedBuffer 中获取的声道数据，包含多个声道.
 * @param {number} sampleRate 采样率.
 * @return {Array}
 */
function getPeaks (channelData, sampleRate = 22050) {
  console.log(channelData)
  // 本函数在这里查询给定的 channelData 中音量最大的位置，以作为节拍依据.

  // 我们将把音乐按照 0.5 秒分为若干份，然后在若干份内进行查询，所以一个峰值前后会间隔 0.5 秒至少.
  // 默认采样率为 22050，即 44100 的一半（0.5 秒）.

  // 这样其实是一个定 bpm 的采样方式.

  // What we're going to do here, is to divide up our audio into parts.
  // We will then identify, for each part, what the loudest sample is in that part.

  // It's implied that that sample would represent the most likely 'beat' within that part.
  // Each part is 0.5 seconds long - or 22,050 samples.

  // This will give us 60 'beats' - we will only take the loudest half of those.

  // This will allow us to ignore breaks, and allow us to address tracks with a BPM below 120.

  const partSize = sampleRate / 2  // 设置每份采样长度，这里是 0.5s 个采样数.
  const parts = channelData[0].length / partSize  // 采样成员数量.
  let peaks = []  // 峰值结果数组.

  // 循环每一份采样成员.
  for (let i = 0; i < parts; i++) {
    let max = 0

    // 在每一份采样成员范围内循环检查每个 position 查找最高音量值与其对应位置.
    for (let position = i * partSize; position < (i + 1) * partSize; position++) {
      let currentVolume = Math.max(Math.abs(channelData[0][position]), Math.abs(channelData[1][position]));
      if (!max || (currentVolume > max.volume)) {
        max = {
          position: position,
          volume: currentVolume
        }
      }
    }
    peaks.push(max)
  }

  return peaks
}

/**
 * 获取峰值间隔统计.
 *
 * @param {Array<Object>} peaks
 * @return {Array}
 */
function getPeakIntervals (peaks) {

  // What we now do is get all of our peaks, and then measure the distance to
  // other peaks, to create intervals.  Then based on the distance between
  // those peaks (the distance of the intervals) we can calculate the BPM of
  // that particular interval.

  // The interval that is seen the most should have the BPM that corresponds
  // to the track itself.

  var groups = [];

  peaks.forEach(function (peak, index) {
    for (var i = 1; (index + i) < peaks.length && i < 10; i++) {
      var group = {
        tempo: (60 * 44100) / (peaks[index + i].position - peak.position),
        count: 1
      };

      while (group.tempo < 90) {
        group.tempo *= 2;
      }

      while (group.tempo > 180) {
        group.tempo /= 2;
      }

      group.tempo = Math.round(group.tempo);

      if (!(groups.some(function(interval) {
          return (interval.tempo === group.tempo ? interval.count++ : 0);
        }))) {
        groups.push(group);
      }
    }
  });
  return groups;
}
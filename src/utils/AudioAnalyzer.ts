// src/utils/AudioAnalyzer.ts

export class AudioController {
    audioContext: AudioContext | null = null;
    analyser: AnalyserNode | null = null;
    source: MediaElementAudioSourceNode | null = null;
    dataArray: Uint8Array | null = null;

    // เริ่มต้นระบบเสียง
    setup(audioElement: HTMLAudioElement) {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();

        this.analyser.fftSize = 256;

        this.source = this.audioContext.createMediaElementSource(audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    // ดึงค่าความดังของเสียงในขณะนั้น
    getAnalysis() {
        const analyser = this.analyser;
        const dataArray = this.dataArray;

        if (!analyser || !dataArray) return { bass: 0, mid: 0, high: 0 };

        // *** FIX FOR VERCEL ERROR ***
        // ใส่ 'as any' เพื่อแก้ error TS2345: Argument of type 'Uint8Array<ArrayBufferLike>'...
        analyser.getByteFrequencyData(dataArray as any);

        // คำนวณค่าเฉลี่ย (ปรับโค้ดให้สั้นลงและ type safe ขึ้น)
        const bass = this.average(dataArray.slice(0, 10));
        const mid = this.average(dataArray.slice(10, 50));
        const high = this.average(dataArray.slice(50, 100));

        return { bass, mid, high };
    }

    // ฟังก์ชันช่วยหาค่าเฉลี่ย
    private average(arr: Uint8Array | ArrayLike<number>) {
        if (arr.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum / arr.length;
    }

    resume() {
        this.audioContext?.resume();
    }
}
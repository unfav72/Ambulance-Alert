// Production browser notification service with Web Audio API emergency chime

class BrowserNotificationService {
  private audioContext: AudioContext | null = null;

  /**
   * Generates a modern synthesized emergency alert chime using Web Audio API
   */
  public playEmergencyAlertTone() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }

      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';

      // Dual-tone urgent medical pulse: 880Hz (A5) pulsing to 1320Hz (E6)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.12);
      osc.frequency.setValueAtTime(880, now + 0.24);
      osc.frequency.setValueAtTime(1320, now + 0.36);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio playback non-critical failure
    }
  }

  /**
   * Checks current browser notification permission
   */
  public getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Prompts user for browser notification permission
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Displays native browser notification and plays audio alert
   */
  public notify(options: {
    title: string;
    body: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    playSound?: boolean;
  }) {
    if (options.playSound ?? true) {
      this.playEmergencyAlertTone();
    }

    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: '/icons/ambulance.svg',
        tag: options.tag || 'emergency-alert',
        requireInteraction: options.requireInteraction ?? true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      // Fallback for environments where new Notification() fails
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(options.title, {
            body: options.body,
            icon: '/icons/ambulance.svg',
            tag: options.tag || 'emergency-alert',
          });
        });
      }
    }
  }
}

export const notificationService = new BrowserNotificationService();

import { useEffect } from 'react';
import { initSocket } from '../socket';

// Bildirim izni isteme
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('[Notification] Permission:', permission);
    });
  }
}

// Tarayıcı bildirimi gönder
export function showNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...options,
    });

    // Tıklandığında pencereyi odakla
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
}

// Bildirim sesi çal - Web Audio API ile
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // İlk ton - 800 Hz
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    
    oscillator1.frequency.value = 800;
    oscillator1.type = 'sine';
    
    gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.3);
    
    // İkinci ton - 600 Hz (0.15 saniye sonra)
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.frequency.value = 600;
    oscillator2.type = 'sine';
    
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.15);
    gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator2.start(audioContext.currentTime + 0.15);
    oscillator2.stop(audioContext.currentTime + 0.5);
    
    // Üçüncü ton - 900 Hz (0.3 saniye sonra)
    const oscillator3 = audioContext.createOscillator();
    const gainNode3 = audioContext.createGain();
    
    oscillator3.connect(gainNode3);
    gainNode3.connect(audioContext.destination);
    
    oscillator3.frequency.value = 900;
    oscillator3.type = 'sine';
    
    gainNode3.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
    gainNode3.gain.setValueAtTime(0.35, audioContext.currentTime + 0.3);
    gainNode3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
    
    oscillator3.start(audioContext.currentTime + 0.3);
    oscillator3.stop(audioContext.currentTime + 0.8);
    
    console.log('[Sound] Notification sound played');
  } catch (e) {
    console.error('[Sound] Failed to play:', e);
  }
}

// Socket.IO ve bildirim hook'u
export function useNotifications(onNewTicket?: (data: any) => void) {
  useEffect(() => {
    // Bildirim izni iste
    requestNotificationPermission();

    // Socket bağlantısını başlat
    const socket = initSocket();

    // Yeni ticket bildirimi
    socket.on('new_ticket', (data: any) => {
      console.log('[Notification] New ticket:', data);
      
      // Her yeni ticket geldiğinde ses çal
      playNotificationSound();
      
      // Kullanıcıya bu ticket atanmışsa bildir
      const userId = localStorage.getItem('userId');
      if (data.assignedTo === userId) {
        showNotification('🔔 Yeni Görev Atandı!', {
          body: `${data.from}: ${data.text?.substring(0, 100)}...`,
          tag: `ticket-${data.ticketId}`,
          requireInteraction: data.isUrgent,
        });
      }

      // Callback çağır (sayfa güncellemesi için)
      if (onNewTicket) {
        onNewTicket(data);
      }
    });

    // Ticket güncellemesi bildirimi
    socket.on('ticket_updated', (data: any) => {
      console.log('[Notification] Ticket updated:', data);
      
      const userId = localStorage.getItem('userId');
      if (data.assignedTo === userId) {
        showNotification('📝 Görev Güncellendi', {
          body: `Görev durumu: ${data.status}`,
          tag: `ticket-update-${data.ticketId}`,
        });
      }

      // Callback çağır
      if (onNewTicket) {
        onNewTicket(data);
      }
    });

    // Acil ticket bildirimi
    socket.on('urgent_ticket', (data: any) => {
      console.log('[Notification] Urgent ticket:', data);
      
      const userId = localStorage.getItem('userId');
      if (data.assignedTo === userId) {
        showNotification('🚨 ACİL GÖREV!', {
          body: `${data.from}: ${data.text?.substring(0, 100)}...`,
          tag: `urgent-${data.ticketId}`,
          requireInteraction: true,
        });
      }

      // Callback çağır
      if (onNewTicket) {
        onNewTicket(data);
      }
    });

    return () => {
      socket.off('new_ticket');
      socket.off('ticket_updated');
      socket.off('urgent_ticket');
    };
  }, [onNewTicket]);
}

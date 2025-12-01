import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'birthday';
  createdAt: string;
  readBy: string[];
  sentBy: string;
  sentByName?: string;
  recipientId?: string;
  organizationId?: string;
}

const NotificationBell = () => {
  const { user, organizationId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchEmployeeAndNotifications = async () => {
      try {
        // Get current user's employee ID and organization
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const currentEmployee = employeesSnapshot.docs.find(doc => doc.data().userId === user.uid);
        const currentEmployeeId = currentEmployee?.id;
        const userOrgId = currentEmployee?.data()?.organizationId || organizationId;

        const q = query(
          collection(db, 'notifications'),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const notifs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Notification[];
          
          // Filter notifications by organization and type
          const filteredNotifs = notifs.filter(n => {
            // Only show notifications from the same organization
            if (n.organizationId && n.organizationId !== userOrgId) {
              return false;
            }
            // Show general notifications or birthday wishes to the recipient
            return n.type === 'general' || (n.type === 'birthday' && n.recipientId === currentEmployeeId);
          });
          
          setNotifications(filteredNotifs);
          const unread = filteredNotifs.filter(n => !n.readBy?.includes(user.uid)).length;
          setUnreadCount(unread);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchEmployeeAndNotifications();
  }, [user, organizationId]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      const notif = notifications.find(n => n.id === notificationId);
      if (notif && !notif.readBy?.includes(user.uid)) {
        await updateDoc(doc(db, 'notifications', notificationId), {
          readBy: [...(notif.readBy || []), user.uid]
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const unreadNotifs = notifications.filter(n => !n.readBy?.includes(user.uid));
      await Promise.all(
        unreadNotifs.map(notif =>
          updateDoc(doc(db, 'notifications', notif.id), {
            readBy: [...(notif.readBy || []), user.uid]
          })
        )
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const isUnread = !notification.readBy?.includes(user?.uid || '');
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-accent cursor-pointer transition-colors ${
                      isUnread ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{notification.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

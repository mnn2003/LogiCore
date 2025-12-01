import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const NotificationManager = () => {
  const { user, organizationId } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter both title and message',
        variant: 'destructive'
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        message: message.trim(),
        type: 'general',
        createdAt: new Date().toISOString(),
        readBy: [],
        sentBy: user?.uid || '',
        sentByName: user?.email?.split('@')[0] || 'HR',
        organizationId: organizationId
      });

      toast({
        title: 'Success',
        description: 'Notification sent to all organization users'
      });

      setTitle('');
      setMessage('');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send notification',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Send Notification to All Users
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Notification Title</Label>
          <Input
            id="title"
            placeholder="Enter notification title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Notification Message</Label>
          <Textarea
            id="message"
            placeholder="Enter notification message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </div>
        <Button 
          onClick={sendNotification} 
          disabled={sending}
          className="w-full"
        >
          {sending ? 'Sending...' : 'Send Notification'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default NotificationManager;

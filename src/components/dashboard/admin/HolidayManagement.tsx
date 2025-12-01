import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Calendar as CalendarIcon, Trash2, Plus, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
}

const HolidayManagement = () => {
  const { organizationId } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, [organizationId]);

  const importIndianHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      // Updated dates for 2025 (Hindu calendar dates vary each year)
      const indianHolidays = currentYear === 2025 ? [
        { date: '2025-01-26', name: 'Republic Day', description: 'National holiday celebrating the adoption of the Constitution' },
        { date: '2025-02-26', name: 'Maha Shivaratri', description: 'Hindu festival' },
        { date: '2025-03-14', name: 'Holi', description: 'Festival of colors' },
        { date: '2025-04-06', name: 'Ram Navami', description: 'Birth of Lord Rama' },
        { date: '2025-04-10', name: 'Mahavir Jayanti', description: 'Jain festival' },
        { date: '2025-04-18', name: 'Good Friday', description: 'Christian holiday' },
        { date: '2025-05-12', name: 'Buddha Purnima', description: 'Birth of Gautama Buddha' },
        { date: '2025-08-15', name: 'Independence Day', description: 'National holiday celebrating independence from British rule' },
        { date: '2025-08-16', name: 'Janmashtami', description: 'Birth of Lord Krishna' },
        { date: '2025-10-02', name: 'Gandhi Jayanti', description: 'Birth anniversary of Mahatma Gandhi' },
        { date: '2025-10-02', name: 'Dussehra', description: 'Victory of good over evil' },
        { date: '2025-10-20', name: 'Diwali', description: 'Festival of lights' },
        { date: '2025-10-21', name: 'Govardhan Puja', description: 'Day after Diwali' },
        { date: '2025-11-05', name: 'Guru Nanak Jayanti', description: 'Birth of Guru Nanak' },
        { date: '2025-12-25', name: 'Christmas', description: 'Birth of Jesus Christ' }
      ] : [
        { date: `${currentYear}-01-26`, name: 'Republic Day', description: 'National holiday celebrating the adoption of the Constitution' },
        { date: `${currentYear}-03-08`, name: 'Maha Shivaratri', description: 'Hindu festival' },
        { date: `${currentYear}-03-25`, name: 'Holi', description: 'Festival of colors' },
        { date: `${currentYear}-04-17`, name: 'Ram Navami', description: 'Birth of Lord Rama' },
        { date: `${currentYear}-04-21`, name: 'Mahavir Jayanti', description: 'Jain festival' },
        { date: `${currentYear}-04-14`, name: 'Good Friday', description: 'Christian holiday' },
        { date: `${currentYear}-05-23`, name: 'Buddha Purnima', description: 'Birth of Gautama Buddha' },
        { date: `${currentYear}-08-15`, name: 'Independence Day', description: 'National holiday celebrating independence from British rule' },
        { date: `${currentYear}-08-26`, name: 'Janmashtami', description: 'Birth of Lord Krishna' },
        { date: `${currentYear}-10-02`, name: 'Gandhi Jayanti', description: 'Birth anniversary of Mahatma Gandhi' },
        { date: `${currentYear}-10-12`, name: 'Dussehra', description: 'Victory of good over evil' },
        { date: `${currentYear}-10-31`, name: 'Diwali', description: 'Festival of lights' },
        { date: `${currentYear}-11-01`, name: 'Diwali (Second Day)', description: 'Festival of lights - Day 2' },
        { date: `${currentYear}-11-15`, name: 'Guru Nanak Jayanti', description: 'Birth of Guru Nanak' },
        { date: `${currentYear}-12-25`, name: 'Christmas', description: 'Birth of Jesus Christ' }
      ];

      const batch = writeBatch(db);
      let addedCount = 0;

      for (const holiday of indianHolidays) {
        // Check if holiday already exists
        const existing = holidays.find(h => h.date === holiday.date);
        if (!existing) {
          const docRef = doc(collection(db, 'holidays'));
          batch.set(docRef, {
            ...holiday,
            ...(organizationId && { organizationId })
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        await batch.commit();
        toast.success(`Added ${addedCount} Indian holidays for ${currentYear}!`);
        fetchHolidays();
      } else {
        toast.success('All Indian holidays for this year are already added!');
      }
    } catch (error) {
      console.error('Error importing holidays:', error);
      toast.error('Failed to import holidays');
    }
  };

  const fetchHolidays = async () => {
    try {
      // Filter holidays by organizationId
      const q = organizationId 
        ? query(collection(db, 'holidays'), where('organizationId', '==', organizationId))
        : collection(db, 'holidays');
      const snapshot = await getDocs(q);
      const holidayList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Holiday[];
      setHolidays(holidayList);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    }
  };

  const handleAddHoliday = async () => {
    if (!selectedDate || !holidayName.trim()) {
      toast.error('Please select a date and enter a holiday name');
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await addDoc(collection(db, 'holidays'), {
        date: dateStr,
        name: holidayName,
        description: holidayDescription,
        ...(organizationId && { organizationId })
      });
      toast.success('Holiday added successfully!');
      setHolidayName('');
      setHolidayDescription('');
      fetchHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'holidays', id));
      toast.success('Holiday deleted successfully!');
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  const holidayDates = holidays.map(h => new Date(h.date));

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarIcon className="h-6 w-6 text-primary" />
              Add New Holiday
            </CardTitle>
            <Button onClick={importIndianHolidays} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Import Indian Holidays
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  holiday: holidayDates
                }}
                modifiersClassNames={{
                  holiday: 'bg-destructive/20 text-destructive font-bold'
                }}
                className="rounded-lg border shadow-sm"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Holiday Name</label>
                <Input
                  placeholder="e.g., Christmas"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  placeholder="Additional details..."
                  value={holidayDescription}
                  onChange={(e) => setHolidayDescription(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Date</label>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="font-semibold">{selectedDate ? format(selectedDate, 'MMMM dd, yyyy') : 'No date selected'}</p>
                </div>
              </div>
              <Button onClick={handleAddHoliday} size="lg" className="w-full">
                <Plus className="mr-2 h-5 w-5" />
                Add Holiday
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Holiday List ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {holidays.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No holidays added yet</p>
            ) : (
              holidays
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{holiday.name}</p>
                        <Badge variant="outline">{(() => {
                          const [year, month, day] = holiday.date.split('-').map(Number);
                          return format(new Date(year, month - 1, day), 'MMM dd, yyyy');
                        })()}</Badge>
                      </div>
                      {holiday.description && (
                        <p className="text-sm text-muted-foreground">{holiday.description}</p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayManagement;

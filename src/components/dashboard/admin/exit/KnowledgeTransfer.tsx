import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { BookOpen, Plus, CheckCircle, Edit } from 'lucide-react';

interface KnowledgeTransferItem {
  category: string;
  details: string;
  handoverTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedDate: string;
}

interface KnowledgeTransfer {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  items: KnowledgeTransferItem[];
  overallStatus: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
}

const KNOWLEDGE_CATEGORIES = [
  'Projects & Responsibilities',
  'System Access & Credentials',
  'Important Contacts',
  'Ongoing Tasks',
  'Documentation',
  'Tools & Software',
  'Processes & Workflows',
  'Client Information'
];

export const KnowledgeTransfer = () => {
  const [transfers, setTransfers] = useState<KnowledgeTransfer[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<KnowledgeTransfer | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    designation: '',
    items: KNOWLEDGE_CATEGORIES.map(cat => ({
      category: cat,
      details: '',
      handoverTo: '',
      status: 'pending' as const,
      completedDate: ''
    }))
  });

  useEffect(() => {
    fetchTransfers();
    fetchResignations();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'employees'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchResignations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'resignations'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved' || r.status === 'in-clearance'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchTransfers = async () => {
    try {
      const q = query(collection(db, 'knowledge_transfers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as KnowledgeTransfer[];
      setTransfers(data);
    } catch (error) {
      console.error('Error fetching knowledge transfers:', error);
      toast.error('Failed to fetch knowledge transfers');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedResignation = resignations.find(r => r.employeeId === formData.employeeId);
      
      if (!selectedResignation) {
        toast.error('Resignation not found');
        return;
      }

      await addDoc(collection(db, 'knowledge_transfers'), {
        employeeId: formData.employeeId,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        designation: formData.designation,
        items: formData.items,
        overallStatus: 'pending',
        createdAt: Timestamp.now()
      });

      toast.success('Knowledge transfer documentation created');
      setIsDialogOpen(false);
      resetForm();
      fetchTransfers();
    } catch (error) {
      console.error('Error creating knowledge transfer:', error);
      toast.error('Failed to create knowledge transfer');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      designation: '',
      items: KNOWLEDGE_CATEGORIES.map(cat => ({
        category: cat,
        details: '',
        handoverTo: '',
        status: 'pending',
        completedDate: ''
      }))
    });
  };

  const updateTransferItem = async (transferId: string, itemIndex: number, updatedItem: KnowledgeTransferItem) => {
    if (!selectedTransfer) return;

    setLoading(true);
    try {
      const updatedItems = [...selectedTransfer.items];
      updatedItems[itemIndex] = {
        ...updatedItem,
        completedDate: updatedItem.status === 'completed' ? new Date().toISOString() : ''
      };

      const allCompleted = updatedItems.every(item => item.status === 'completed');
      const anyInProgress = updatedItems.some(item => item.status === 'in-progress');
      
      const overallStatus = allCompleted ? 'completed' : 
                           anyInProgress ? 'in-progress' : 'pending';

      await updateDoc(doc(db, 'knowledge_transfers', transferId), {
        items: updatedItems,
        overallStatus
      });

      toast.success('Knowledge transfer updated');
      fetchTransfers();
      setEditDialogOpen(false);
      setSelectedTransfer(null);
    } catch (error) {
      console.error('Error updating knowledge transfer:', error);
      toast.error('Failed to update knowledge transfer');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (transfer: KnowledgeTransfer) => {
    setSelectedTransfer(transfer);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Knowledge Transfer Documentation</h3>
          <p className="text-sm text-muted-foreground">Document and track knowledge transfer process</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Documentation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Knowledge Transfer Documentation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Employee *</Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {resignations.map(res => (
                        <SelectItem key={res.employeeId} value={res.employeeId}>
                          {res.employeeName} - {res.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="Enter designation"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Knowledge Transfer Checklist</h4>
                {formData.items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6 space-y-3">
                      <h5 className="font-medium">{item.category}</h5>
                      <div className="grid gap-3">
                        <div>
                          <Label>Details</Label>
                          <Textarea
                            value={item.details}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              updatedItems[index].details = e.target.value;
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            placeholder="Enter details for this category"
                          />
                        </div>
                        <div>
                          <Label>Handover To</Label>
                          <Select
                            value={item.handoverTo}
                            onValueChange={(value) => {
                              const updatedItems = [...formData.items];
                              updatedItems[index].handoverTo = value;
                              setFormData({ ...formData, items: updatedItems });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map(emp => (
                                <SelectItem key={emp.id} value={emp.name}>
                                  {emp.name} - {emp.employeeCode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Documentation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {transfers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No knowledge transfer documentation created
            </CardContent>
          </Card>
        ) : (
          transfers.map((transfer) => (
            <Card key={transfer.id}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{transfer.employeeName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {transfer.employeeCode} | {transfer.designation}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      transfer.overallStatus === 'completed' ? 'default' :
                      transfer.overallStatus === 'in-progress' ? 'secondary' : 'outline'
                    }>
                      {transfer.overallStatus}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(transfer)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Update
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {transfer.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                        <div>
                          <p className="font-medium">{item.category}</p>
                          {item.handoverTo && (
                            <p className="text-sm text-muted-foreground">Handover to: {item.handoverTo}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={
                        item.status === 'completed' ? 'default' :
                        item.status === 'in-progress' ? 'secondary' : 'outline'
                      }>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Transfer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Knowledge Transfer</DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              {selectedTransfer.items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-3">
                    <h5 className="font-semibold">{item.category}</h5>
                    <div className="grid gap-3">
                      <div>
                        <Label>Details</Label>
                        <Textarea
                          value={item.details}
                          onChange={(e) => {
                            const updatedItems = [...selectedTransfer.items];
                            updatedItems[index].details = e.target.value;
                            setSelectedTransfer({ ...selectedTransfer, items: updatedItems });
                          }}
                          placeholder="Enter details"
                        />
                      </div>
                      <div>
                        <Label>Handover To</Label>
                        <Input
                          value={item.handoverTo}
                          onChange={(e) => {
                            const updatedItems = [...selectedTransfer.items];
                            updatedItems[index].handoverTo = e.target.value;
                            setSelectedTransfer({ ...selectedTransfer, items: updatedItems });
                          }}
                          placeholder="Employee name"
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={item.status}
                          onValueChange={(value: any) => {
                            const updated = { ...item, status: value };
                            updateTransferItem(selectedTransfer.id, index, updated);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

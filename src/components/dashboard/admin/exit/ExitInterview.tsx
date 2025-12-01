import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { MessageSquare, Plus, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ExitInterviewData {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  interviewDate: string;
  interviewer: string;
  overallExperience: string;
  reasonForLeaving: string;
  workEnvironment: string;
  management: string;
  careerGrowth: string;
  workLifeBalance: string;
  recommendations: string;
  wouldRecommendCompany: boolean;
  wouldRejoin: boolean;
  additionalComments: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}

export const ExitInterview = () => {
  const [interviews, setInterviews] = useState<ExitInterviewData[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<ExitInterviewData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    interviewDate: '',
    interviewer: '',
    overallExperience: '',
    reasonForLeaving: '',
    workEnvironment: '',
    management: '',
    careerGrowth: '',
    workLifeBalance: '',
    recommendations: '',
    wouldRecommendCompany: false,
    wouldRejoin: false,
    additionalComments: ''
  });

  useEffect(() => {
    fetchInterviews();
    fetchResignations();
  }, []);

  const fetchResignations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'resignations'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchInterviews = async () => {
    try {
      const q = query(collection(db, 'exit_interviews'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as ExitInterviewData[];
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast.error('Failed to fetch exit interviews');
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

      await addDoc(collection(db, 'exit_interviews'), {
        ...formData,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        status: 'completed',
        createdAt: Timestamp.now()
      });

      toast.success('Exit interview recorded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchInterviews();
    } catch (error) {
      console.error('Error recording exit interview:', error);
      toast.error('Failed to record exit interview');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      interviewDate: '',
      interviewer: '',
      overallExperience: '',
      reasonForLeaving: '',
      workEnvironment: '',
      management: '',
      careerGrowth: '',
      workLifeBalance: '',
      recommendations: '',
      wouldRecommendCompany: false,
      wouldRejoin: false,
      additionalComments: ''
    });
  };

  const viewInterview = (interview: ExitInterviewData) => {
    setSelectedInterview(interview);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Exit Interview System</h3>
          <p className="text-sm text-muted-foreground">Conduct and manage exit interviews</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Conduct Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Exit Interview Form</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
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
                  <Label htmlFor="interviewDate">Interview Date *</Label>
                  <Input
                    id="interviewDate"
                    type="date"
                    value={formData.interviewDate}
                    onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="interviewer">Interviewer *</Label>
                  <Input
                    id="interviewer"
                    value={formData.interviewer}
                    onChange={(e) => setFormData({ ...formData, interviewer: e.target.value })}
                    placeholder="Enter interviewer name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="overallExperience">Overall Experience Rating *</Label>
                  <Select
                    value={formData.overallExperience}
                    onValueChange={(value) => setFormData({ ...formData, overallExperience: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="workEnvironment">Work Environment Rating *</Label>
                  <Select
                    value={formData.workEnvironment}
                    onValueChange={(value) => setFormData({ ...formData, workEnvironment: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="reasonForLeaving">Primary Reason for Leaving *</Label>
                  <Textarea
                    id="reasonForLeaving"
                    value={formData.reasonForLeaving}
                    onChange={(e) => setFormData({ ...formData, reasonForLeaving: e.target.value })}
                    placeholder="Describe the primary reason"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="management">Management Feedback</Label>
                  <Textarea
                    id="management"
                    value={formData.management}
                    onChange={(e) => setFormData({ ...formData, management: e.target.value })}
                    placeholder="Feedback about management"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="careerGrowth">Career Growth Feedback</Label>
                  <Textarea
                    id="careerGrowth"
                    value={formData.careerGrowth}
                    onChange={(e) => setFormData({ ...formData, careerGrowth: e.target.value })}
                    placeholder="Feedback about career growth opportunities"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="workLifeBalance">Work-Life Balance Feedback</Label>
                  <Textarea
                    id="workLifeBalance"
                    value={formData.workLifeBalance}
                    onChange={(e) => setFormData({ ...formData, workLifeBalance: e.target.value })}
                    placeholder="Feedback about work-life balance"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="recommendations">Recommendations for Improvement</Label>
                  <Textarea
                    id="recommendations"
                    value={formData.recommendations}
                    onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                    placeholder="Suggestions for company improvement"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wouldRecommendCompany"
                    checked={formData.wouldRecommendCompany}
                    onChange={(e) => setFormData({ ...formData, wouldRecommendCompany: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="wouldRecommendCompany" className="cursor-pointer">
                    Would recommend company to others
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wouldRejoin"
                    checked={formData.wouldRejoin}
                    onChange={(e) => setFormData({ ...formData, wouldRejoin: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="wouldRejoin" className="cursor-pointer">
                    Would consider rejoining
                  </Label>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="additionalComments">Additional Comments</Label>
                  <Textarea
                    id="additionalComments"
                    value={formData.additionalComments}
                    onChange={(e) => setFormData({ ...formData, additionalComments: e.target.value })}
                    placeholder="Any additional feedback"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Interview'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="border rounded-lg">
        <div className="min-w-[800px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Interview Date</TableHead>
                <TableHead>Interviewer</TableHead>
                <TableHead>Overall Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No exit interviews recorded
                  </TableCell>
                </TableRow>
            ) : (
              interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell className="font-medium">{interview.employeeName}</TableCell>
                  <TableCell>{interview.employeeCode}</TableCell>
                  <TableCell>{new Date(interview.interviewDate).toLocaleDateString()}</TableCell>
                  <TableCell>{interview.interviewer}</TableCell>
                  <TableCell>
                    <Badge variant={
                      interview.overallExperience === 'excellent' ? 'default' :
                      interview.overallExperience === 'good' ? 'secondary' : 'outline'
                    }>
                      {interview.overallExperience}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{interview.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewInterview(interview)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </ScrollArea>

      {/* View Interview Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exit Interview Details</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Employee Name</Label>
                      <p className="font-medium">{selectedInterview.employeeName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Employee Code</Label>
                      <p className="font-medium">{selectedInterview.employeeCode}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Interview Date</Label>
                      <p className="font-medium">{new Date(selectedInterview.interviewDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Interviewer</Label>
                      <p className="font-medium">{selectedInterview.interviewer}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Overall Experience</Label>
                      <Badge variant="default">{selectedInterview.overallExperience}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Work Environment</Label>
                      <Badge variant="secondary">{selectedInterview.workEnvironment}</Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Reason for Leaving</Label>
                    <p className="mt-1">{selectedInterview.reasonForLeaving}</p>
                  </div>

                  {selectedInterview.management && (
                    <div>
                      <Label className="text-muted-foreground">Management Feedback</Label>
                      <p className="mt-1">{selectedInterview.management}</p>
                    </div>
                  )}

                  {selectedInterview.careerGrowth && (
                    <div>
                      <Label className="text-muted-foreground">Career Growth</Label>
                      <p className="mt-1">{selectedInterview.careerGrowth}</p>
                    </div>
                  )}

                  {selectedInterview.workLifeBalance && (
                    <div>
                      <Label className="text-muted-foreground">Work-Life Balance</Label>
                      <p className="mt-1">{selectedInterview.workLifeBalance}</p>
                    </div>
                  )}

                  {selectedInterview.recommendations && (
                    <div>
                      <Label className="text-muted-foreground">Recommendations</Label>
                      <p className="mt-1">{selectedInterview.recommendations}</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedInterview.wouldRecommendCompany}
                        disabled
                        className="rounded border-gray-300"
                      />
                      <Label>Would recommend company</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedInterview.wouldRejoin}
                        disabled
                        className="rounded border-gray-300"
                      />
                      <Label>Would consider rejoining</Label>
                    </div>
                  </div>

                  {selectedInterview.additionalComments && (
                    <div>
                      <Label className="text-muted-foreground">Additional Comments</Label>
                      <p className="mt-1">{selectedInterview.additionalComments}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

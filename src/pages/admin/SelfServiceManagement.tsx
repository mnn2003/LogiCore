import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { useAuth } from '@/contexts/AuthContext';

interface TaxDeclaration {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  status: string;
  submittedDate: string;
}

interface InvestmentProof {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  documentName: string;
  documentUrl?: string;
  status: string;
  uploadedDate: string;
}

interface LoanApplication {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  appliedDate: string;
}

interface Reimbursement {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  description: string;
  documentName?: string;
  documentUrl?: string;
  status: string;
  submittedDate: string;
}

export default function SelfServiceManagement() {
  const { organizationId } = useAuth();
  const [taxDeclarations, setTaxDeclarations] = useState<TaxDeclaration[]>([]);
  const [investmentProofs, setInvestmentProofs] = useState<InvestmentProof[]>([]);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchAllData();
    }
  }, [organizationId]);

  const fetchAllData = async () => {
    if (!organizationId) return;
    
    try {
      const [taxDocs, investmentDocs, loanDocs, reimbursementDocs] = await Promise.all([
        getDocs(query(collection(db, 'tax_declarations'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'investment_proofs'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'loan_applications'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'reimbursements'), where('organizationId', '==', organizationId)))
      ]);

      setTaxDeclarations(taxDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaxDeclaration)));
      setInvestmentProofs(investmentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentProof)));
      setLoanApplications(loanDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoanApplication)));
      setReimbursements(reimbursementDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reimbursement)));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (collectionName: string, id: string, status: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), { status });
      toast.success('Status updated successfully');
      fetchAllData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <>
      <Layout pageTitle="Self Service Management">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardDescription>Manage employee self-service requests and submissions</CardDescription>
            </CardHeader>
            <CardContent>
                  <Tabs defaultValue="tax" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="tax">Tax Declarations</TabsTrigger>
                      <TabsTrigger value="investment">Investment Proofs</TabsTrigger>
                      <TabsTrigger value="loan">Loan Applications</TabsTrigger>
                      <TabsTrigger value="reimbursement">Reimbursements</TabsTrigger>
                    </TabsList>

                  <TabsContent value="tax" className="space-y-4">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Submitted Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taxDeclarations.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No tax declarations found
                              </TableCell>
                            </TableRow>
                          ) : (
                            taxDeclarations.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.employeeName}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground text-sm">No document attached</span>
                                </TableCell>
                                <TableCell>{new Date(item.submittedDate).toLocaleDateString()}</TableCell>
                                <TableCell><StatusBadge status={item.status} /></TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateStatus('tax_declarations', item.id, 'approved')}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => updateStatus('tax_declarations', item.id, 'rejected')}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="investment" className="space-y-4">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Uploaded Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {investmentProofs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No investment proofs found
                              </TableCell>
                            </TableRow>
                          ) : (
                            investmentProofs.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.employeeName}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                                <TableCell>
                                  {item.documentUrl ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-2"
                                      onClick={() => {
                                        setSelectedDoc({ url: item.documentUrl!, name: item.documentName });
                                        setViewerOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                      {item.documentName}
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">No document</span>
                                  )}
                                </TableCell>
                                <TableCell>{new Date(item.uploadedDate).toLocaleDateString()}</TableCell>
                                <TableCell><StatusBadge status={item.status} /></TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateStatus('investment_proofs', item.id, 'approved')}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => updateStatus('investment_proofs', item.id, 'rejected')}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="loan" className="space-y-4">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Applied Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loanApplications.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No loan applications found
                              </TableCell>
                            </TableRow>
                          ) : (
                            loanApplications.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.employeeName}</TableCell>
                                <TableCell>{item.type}</TableCell>
                                <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                                <TableCell>{item.reason}</TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground text-sm">No document attached</span>
                                </TableCell>
                                <TableCell>{new Date(item.appliedDate).toLocaleDateString()}</TableCell>
                                <TableCell><StatusBadge status={item.status} /></TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateStatus('loan_applications', item.id, 'approved')}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => updateStatus('loan_applications', item.id, 'rejected')}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="reimbursement" className="space-y-4">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Submitted Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reimbursements.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No reimbursements found
                              </TableCell>
                            </TableRow>
                          ) : (
                            reimbursements.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.employeeName}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>
                                  {item.documentUrl ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-2"
                                      onClick={() => {
                                        setSelectedDoc({ url: item.documentUrl!, name: item.documentName! });
                                        setViewerOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                      {item.documentName}
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">No document attached</span>
                                  )}
                                </TableCell>
                                <TableCell>{new Date(item.submittedDate).toLocaleDateString()}</TableCell>
                                <TableCell><StatusBadge status={item.status} /></TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateStatus('reimbursements', item.id, 'approved')}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => updateStatus('reimbursements', item.id, 'rejected')}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </Layout>
      
        {selectedDoc && (
          <DocumentViewer
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            documentUrl={selectedDoc.url}
            documentName={selectedDoc.name}
          />
        )}
      </>
  );
}

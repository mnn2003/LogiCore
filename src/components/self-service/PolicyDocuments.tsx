import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Plus, Edit, Trash2, Search, Filter, Calendar, BookOpen, Shield, Users, Briefcase, Heart } from 'lucide-react';
import { toast } from 'sonner';

interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  description: string;
  lastUpdated: string;
  fileSize?: string;
  downloads?: number;
}

export default function PolicyDocuments() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'hr' || userRole === 'hod';

  const [policies, setPolicies] = useState<PolicyDocument[]>([
    {
      id: '1',
      title: 'Employee Handbook',
      category: 'General',
      description: 'Complete guide to company policies, procedures, and expectations for all employees',
      lastUpdated: '2024-01-15',
      fileSize: '2.4 MB',
      downloads: 145
    },
    {
      id: '2',
      title: 'Leave Policy',
      category: 'Leave Management',
      description: 'Details about leave types, entitlements, application process, and approval workflow',
      lastUpdated: '2024-01-10',
      fileSize: '1.8 MB',
      downloads: 89
    },
    {
      id: '3',
      title: 'Code of Conduct',
      category: 'Ethics',
      description: 'Professional ethics, behavioral guidelines, and workplace conduct standards',
      lastUpdated: '2024-01-05',
      fileSize: '1.2 MB',
      downloads: 67
    },
    {
      id: '4',
      title: 'Compensation & Benefits',
      category: 'Benefits',
      description: 'Comprehensive information about salary structure, benefits package, and employee perks',
      lastUpdated: '2024-01-20',
      fileSize: '3.1 MB',
      downloads: 112
    },
    {
      id: '5',
      title: 'Remote Work Policy',
      category: 'Work Arrangements',
      description: 'Guidelines for remote and hybrid work arrangements, equipment, and communication',
      lastUpdated: '2024-01-12',
      fileSize: '1.5 MB',
      downloads: 78
    },
    {
      id: '6',
      title: 'Data Security Policy',
      category: 'Security',
      description: 'Guidelines for handling company data, security protocols, and confidentiality',
      lastUpdated: '2024-01-08',
      fileSize: '2.1 MB',
      downloads: 93
    },
    {
      id: '7',
      title: 'Health & Safety Policy',
      category: 'Compliance',
      description: 'Workplace health and safety guidelines, emergency procedures, and compliance requirements',
      lastUpdated: '2024-01-18',
      fileSize: '1.9 MB',
      downloads: 56
    },
    {
      id: '8',
      title: 'Performance Management',
      category: 'HR',
      description: 'Performance review process, goal setting, feedback mechanisms, and career development',
      lastUpdated: '2024-01-22',
      fileSize: '2.7 MB',
      downloads: 101
    },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
  });

  // Filter policies based on search and category
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = ['all', ...new Set(policies.map(policy => policy.category))];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'General':
        return <BookOpen className="h-4 w-4" />;
      case 'Leave Management':
        return <Calendar className="h-4 w-4" />;
      case 'Ethics':
        return <Shield className="h-4 w-4" />;
      case 'Benefits':
        return <Heart className="h-4 w-4" />;
      case 'Work Arrangements':
        return <Briefcase className="h-4 w-4" />;
      case 'Security':
        return <Shield className="h-4 w-4" />;
      case 'Compliance':
        return <Shield className="h-4 w-4" />;
      case 'HR':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'General': 'bg-blue-100 text-blue-800',
      'Leave Management': 'bg-green-100 text-green-800',
      'Ethics': 'bg-purple-100 text-purple-800',
      'Benefits': 'bg-orange-100 text-orange-800',
      'Work Arrangements': 'bg-indigo-100 text-indigo-800',
      'Security': 'bg-red-100 text-red-800',
      'Compliance': 'bg-yellow-100 text-yellow-800',
      'HR': 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleDownload = (policy: PolicyDocument) => {
    // Update download count
    setPolicies(policies.map(p => 
      p.id === policy.id 
        ? { ...p, downloads: (p.downloads || 0) + 1 }
        : p
    ));
    toast.success(`Downloading ${policy.title}`);
  };

  const handleAddNew = () => {
    setEditingPolicy(null);
    setFormData({ title: '', category: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (policy: PolicyDocument) => {
    setEditingPolicy(policy);
    setFormData({
      title: policy.title,
      category: policy.category,
      description: policy.description,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (policyId: string) => {
    setPolicies(policies.filter(p => p.id !== policyId));
    toast.success('Policy document deleted');
  };

  const handleSave = () => {
    if (!formData.title || !formData.category || !formData.description) {
      toast.error('Please fill in all fields');
      return;
    }

    if (editingPolicy) {
      // Update existing
      setPolicies(policies.map(p => 
        p.id === editingPolicy.id 
          ? { 
              ...p, 
              ...formData, 
              lastUpdated: new Date().toISOString().split('T')[0] 
            }
          : p
      ));
      toast.success('Policy document updated');
    } else {
      // Add new
      const newPolicy: PolicyDocument = {
        id: Date.now().toString(),
        ...formData,
        lastUpdated: new Date().toISOString().split('T')[0],
        fileSize: '1.0 MB',
        downloads: 0
      };
      setPolicies([newPolicy, ...policies]);
      toast.success('Policy document added');
    }

    setIsDialogOpen(false);
    setFormData({ title: '', category: '', description: '' });
  };

  // Calculate stats
  const totalPolicies = policies.length;
  const totalDownloads = policies.reduce((sum, policy) => sum + (policy.downloads || 0), 0);
  const recentPolicies = policies.filter(policy => {
    const policyDate = new Date(policy.lastUpdated);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return policyDate >= thirtyDaysAgo;
  }).length;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-600 font-medium">Total Policies</div>
          </div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalPolicies}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-green-600" />
            <div className="text-xs text-green-600 font-medium">Total Downloads</div>
          </div>
          <div className="text-lg font-bold text-green-900 mt-1">{totalDownloads}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <div className="text-xs text-orange-600 font-medium">Recent Updates</div>
          </div>
          <div className="text-lg font-bold text-orange-900 mt-1">{recentPolicies}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-600" />
            <div className="text-xs text-purple-600 font-medium">Categories</div>
          </div>
          <div className="text-lg font-bold text-purple-900 mt-1">
            {new Set(policies.map(p => p.category)).size}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Policy Documents</CardTitle>
                <CardDescription>Access and download company policy documents</CardDescription>
              </div>
            </div>
            
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Policy
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {editingPolicy ? 'Edit Policy Document' : 'Add New Policy Document'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Employee Handbook"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Leave Management">Leave Management</SelectItem>
                          <SelectItem value="Ethics">Ethics</SelectItem>
                          <SelectItem value="Benefits">Benefits</SelectItem>
                          <SelectItem value="Work Arrangements">Work Arrangements</SelectItem>
                          <SelectItem value="Security">Security</SelectItem>
                          <SelectItem value="Compliance">Compliance</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of the policy document"
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                      {editingPolicy ? 'Update' : 'Add'} Policy
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter(cat => cat !== 'all').map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No policies found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'No policy documents available'
                }
              </p>
              {(searchQuery || selectedCategory !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Grid View */}
              <div className="hidden lg:block p-4">
                <ScrollArea className="h-[500px]">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pr-4">
                    {filteredPolicies.map((policy) => (
                      <Card key={policy.id} className="hover:shadow-md transition-shadow group">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                {getCategoryIcon(policy.category)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate">{policy.title}</CardTitle>
                                <Badge 
                                  variant="outline" 
                                  className={getCategoryColor(policy.category) + " mt-1 text-xs"}
                                >
                                  {policy.category}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {policy.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Updated: {new Date(policy.lastUpdated).toLocaleDateString()}
                              </div>
                              {policy.fileSize && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {policy.fileSize}
                                </div>
                              )}
                            </div>
                            {policy.downloads !== undefined && (
                              <div className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {policy.downloads} downloads
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDownload(policy)}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            
                            {isAdmin && (
                              <div className="flex gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleEdit(policy)}
                                  className="hover:bg-blue-50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleDelete(policy.id)}
                                  className="hover:bg-red-50 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Mobile List View */}
              <div className="lg:hidden space-y-3 p-4">
                {filteredPolicies.map((policy) => (
                  <Card key={policy.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {getCategoryIcon(policy.category)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-base">{policy.title}</h3>
                            <Badge 
                              variant="outline" 
                              className={getCategoryColor(policy.category) + " mt-1 text-xs"}
                            >
                              {policy.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {policy.description}
                      </p>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(policy.lastUpdated).toLocaleDateString()}
                        </div>
                        {policy.fileSize && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {policy.fileSize}
                          </div>
                        )}
                        {policy.downloads !== undefined && (
                          <div className="col-span-2 flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {policy.downloads} downloads
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(policy)}
                          className="flex-1 hover:bg-green-50 hover:text-green-600"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        
                        {isAdmin && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEdit(policy)}
                              className="hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDelete(policy.id)}
                              className="hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResignationSubmission } from '@/components/dashboard/employee/exit/ResignationSubmission';
import { MyResignation } from '@/components/dashboard/employee/exit/MyResignation';
import { MyClearance } from '@/components/dashboard/employee/exit/MyClearance';
import { MySettlement } from '@/components/dashboard/employee/exit/MySettlement';

const Exit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <Layout pageTitle="Exit / Resignation">
      <div className="p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resignation Management</CardTitle>
            <CardDescription>
              Submit resignation requests and track your exit process
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <Tabs defaultValue="submit" className="w-full">
              <TabsList className="w-full inline-flex lg:grid lg:grid-cols-4 h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="submit" className="flex-1 min-w-[140px]">Submit Resignation</TabsTrigger>
                <TabsTrigger value="status" className="flex-1 min-w-[140px]">My Resignation</TabsTrigger>
                <TabsTrigger value="clearance" className="flex-1 min-w-[140px]">Clearance Status</TabsTrigger>
                <TabsTrigger value="settlement" className="flex-1 min-w-[140px]">Settlement</TabsTrigger>
              </TabsList>
              
              <TabsContent value="submit">
                <ResignationSubmission />
              </TabsContent>
              
              <TabsContent value="status">
                <MyResignation />
              </TabsContent>
              
              <TabsContent value="clearance">
                <MyClearance />
              </TabsContent>
              
              <TabsContent value="settlement">
                <MySettlement />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Exit;

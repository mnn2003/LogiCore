import Layout from '@/components/Layout';
import DashboardSettings from '@/components/dashboard/DashboardSettings';

const Settings = () => {
  return (
    <Layout pageTitle="Settings">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <DashboardSettings />
      </div>
    </Layout>
  );
};

export default Settings;

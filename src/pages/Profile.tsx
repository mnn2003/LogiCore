import Layout from '@/components/Layout';
import ProfileTab from '@/components/dashboard/employee/ProfileTab';

const Profile = () => {
  return (
    <Layout pageTitle="Profile">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <ProfileTab />
      </div>
    </Layout>
  );
};

export default Profile;

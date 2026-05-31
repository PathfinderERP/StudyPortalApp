import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Animated,
  TextInput,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../constants/theme';
import { ThemedText } from '../components/themed-text';
import { useColorScheme } from '../hooks/use-color-scheme';
import { storage } from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StudentDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();

  // Theme states
  const [localTheme, setLocalTheme] = useState(null);
  const currentScheme = localTheme || systemScheme || 'light';
  const isDarkMode = currentScheme === 'dark';
  const theme = Colors[currentScheme];

  // Student Profile Data States
  const [studentData, setStudentData] = useState({
    name: 'fsv',
    enrollment: 'PATH26002135',
    className: 'Class 11',
    attendance: '—',
    gpa: '—',
    streak: '2 days',
    nextExam: 'STUDY PLANNER FOR CLASS 11',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStudentProfile();
  }, []);

  const fetchStudentProfile = async () => {
    setLoading(true);
    try {
      const token = await storage.getItem('userToken');
      
      // Attempt to load local info first
      const cachedUserInfo = await storage.getItem('userInfo');
      if (cachedUserInfo) {
        const parsed = JSON.parse(cachedUserInfo);
        const localName = parsed.first_name || parsed.name || parsed.email?.split('@')[0] || 'fsv';
        const localEnrollment = parsed.admission_number || parsed.admission_id || 'PATH26002135';
        const localClass = parsed.class_level ? `Class ${parsed.class_level}` : (parsed.course || 'Class 11');
        setStudentData(prev => ({
          ...prev,
          name: localName,
          enrollment: localEnrollment,
          className: localClass,
        }));
      }

      // Fetch fresh profile data from the Django API
      let freshName = null;
      let freshEnrollment = null;
      let freshClass = null;

      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/profile/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const profileData = await response.json();
          // Cache the fresh profile
          await storage.setItem('userInfo', JSON.stringify(profileData));
          
          freshName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username;
          freshEnrollment = profileData.admission_number;
          if (profileData.class_level) {
            freshClass = `Class ${profileData.class_level}`;
          }
        }
      } catch (err) {
        console.warn('Error fetching /api/profile/:', err);
      }

      // Also fetch from /api/student/erp-data/ to get exact class name and student details
      try {
        const erpResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/student/erp-data/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (erpResponse.ok) {
          const erpData = await erpResponse.json();
          if (erpData.student?.studentsDetails?.[0]?.studentName) {
            freshName = erpData.student.studentsDetails[0].studentName;
          }
          if (erpData.admissionNumber) {
            freshEnrollment = erpData.admissionNumber;
          }
          if (erpData.class?.name) {
            freshClass = `Class ${erpData.class.name}`;
          }
        }
      } catch (err) {
        console.warn('Error fetching /api/student/erp-data/:', err);
      }

      // Optionally fetch attendance to calculate rate
      try {
        const attendanceResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/student/attendance/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          if (Array.isArray(attendanceData) && attendanceData.length > 0) {
            const present = attendanceData.filter(r => r.status === 'Present').length;
            const rate = Math.round((present / attendanceData.length) * 100);
            setStudentData(prev => ({
              ...prev,
              attendance: String(rate),
            }));
          }
        }
      } catch (err) {
        console.warn('Error fetching attendance:', err);
      }

      if (freshName || freshEnrollment || freshClass) {
        setStudentData(prev => ({
          ...prev,
          name: freshName || prev.name,
          enrollment: freshEnrollment || prev.enrollment,
          className: freshClass || prev.className,
        }));
      }

    } catch (err) {
      console.warn('Could not load profile from API, using local fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStudentProfile();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await storage.deleteItem('userToken');
      await storage.deleteItem('refreshToken');
      await storage.deleteItem('userInfo');
      router.replace('/');
    } catch (err) {
      console.error('Logout error:', err);
      router.replace('/');
    }
  };

  const toggleTheme = () => {
    setLocalTheme(currentScheme === 'dark' ? 'light' : 'dark');
  };

  // Custom colors matching the dark, premium blue slate theme of the screenshot
  const customBg = isDarkMode ? '#090d16' : '#f8f9fa';
  const cardBg = isDarkMode ? '#101726' : '#ffffff';
  const cardBorder = isDarkMode ? '#1e293b' : '#e5e7eb';
  const textColor = isDarkMode ? '#ffffff' : '#4a2d1b';
  const textMuted = isDarkMode ? '#8b9bb4' : '#6e7f8d';

  // Responsive Drawer and View State
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studyMaterialsExpanded, setStudyMaterialsExpanded] = useState(true);

  const drawerAnim = useRef(new Animated.Value(-280)).current;
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 992;

  useEffect(() => {
    if (isLargeScreen) {
      drawerAnim.setValue(0);
    } else {
      drawerAnim.setValue(-280);
      setSidebarOpen(false);
    }
  }, [isLargeScreen]);

  const toggleSidebar = () => {
    if (sidebarOpen) {
      Animated.timing(drawerAnim, {
        toValue: -280,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setSidebarOpen(false));
    } else {
      setSidebarOpen(true);
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleSidebarItemClick = (viewName) => {
    setActiveView(viewName);
    if (!isLargeScreen && sidebarOpen) {
      toggleSidebar();
    }
  };

  // --- STUDY PLANNER STATE ---
  const [plannerTasks, setPlannerTasks] = useState([
    { id: '1', text: 'Revise Chemistry Chapter 3: Chemical Kinetics', completed: false, priority: 'High' },
    { id: '2', text: 'Complete Physics DPP-14 on Electrostatics', completed: true, priority: 'High' },
    { id: '3', text: 'Submit Math assignment for Integrals', completed: false, priority: 'Medium' },
    { id: '4', text: 'Read English literature summary: Chapter 5', completed: false, priority: 'Low' },
  ]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');

  const addPlannerTask = () => {
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      priority: newTaskPriority,
    };
    setPlannerTasks([newTask, ...plannerTasks]);
    setNewTaskText('');
  };

  const togglePlannerTask = (id) => {
    setPlannerTasks(
      plannerTasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deletePlannerTask = (id) => {
    setPlannerTasks(plannerTasks.filter(t => t.id !== id));
  };

  // --- DOUBTS STATE ---
  const [doubtsList, setDoubtsList] = useState([
    {
      id: 'd1',
      subject: 'Physics',
      question: 'How do you derive the electric potential of a uniformly charged thin spherical shell?',
      status: 'Solved',
      date: 'May 28, 2026',
      answer: 'The potential outside (r > R) is V = q / (4πε₀r), and inside (r <= R) is V = q / (4πε₀R), which is constant and equal to the value at the surface. This is derived using Gauss Law to find E first, then integrating E from infinity to r.',
    },
    {
      id: 'd2',
      subject: 'Mathematics',
      question: 'What is the limit of (sin x - x) / x³ as x approaches 0?',
      status: 'Solved',
      date: 'May 29, 2026',
      answer: 'By LHopitals Rule (or Taylor series expansion of sin x = x - x³/6 + ...), we get (x - x³/6 - x)/x³ = -1/6. Thus, the limit is -1/6.',
    },
    {
      id: 'd3',
      subject: 'Chemistry',
      question: 'Why is standard entropy of gas higher than liquid?',
      status: 'Unsolved',
      date: 'May 31, 2026',
      answer: null,
    }
  ]);
  const [doubtSubject, setDoubtSubject] = useState('Physics');
  const [doubtQuestion, setDoubtQuestion] = useState('');

  const submitDoubt = () => {
    if (!doubtQuestion.trim()) {
      Alert.alert('Empty Question', 'Please type your question before submitting.');
      return;
    }
    const newDoubt = {
      id: Date.now().toString(),
      subject: doubtSubject,
      question: doubtQuestion.trim(),
      status: 'Unsolved',
      date: 'Today',
      answer: null,
    };
    setDoubtsList([newDoubt, ...doubtsList]);
    setDoubtQuestion('');
    Alert.alert('Success', 'Your doubt has been submitted. A subject expert will review it soon.');
  };

  // --- GRIEVANCES STATE ---
  const [grievancesList, setGrievancesList] = useState([
    {
      id: 'g1',
      category: 'Technical',
      subject: 'Unable to view study materials PDFs',
      description: 'Whenever I click on the PDF icon, it shows white screen and does not download.',
      status: 'Resolved',
      date: 'May 26, 2026',
      resolution: 'The issue has been resolved in the app update. Please clear cache or update the app.',
    },
    {
      id: 'g2',
      category: 'Academic',
      subject: 'Physics lecture scheduling issue',
      description: 'The morning Physics lecture clashes with my lab class.',
      status: 'In Progress',
      date: 'May 30, 2026',
      resolution: null,
    }
  ]);
  const [grievanceCategory, setGrievanceCategory] = useState('Academic');
  const [grievanceSubject, setGrievanceSubject] = useState('');
  const [grievanceDesc, setGrievanceDesc] = useState('');

  const submitGrievance = () => {
    if (!grievanceSubject.trim() || !grievanceDesc.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in both the subject and description.');
      return;
    }
    const newGrievance = {
      id: `g-${Date.now().toString().slice(-4)}`,
      category: grievanceCategory,
      subject: grievanceSubject.trim(),
      description: grievanceDesc.trim(),
      status: 'Pending',
      date: 'Today',
      resolution: null,
    };
    setGrievancesList([newGrievance, ...grievancesList]);
    setGrievanceSubject('');
    setGrievanceDesc('');
    Alert.alert('Grievance Logged', `Your grievance has been logged successfully (Ticket: ${newGrievance.id}).`);
  };

  // --- CLASSES STATE ---
  const [selectedClassDay, setSelectedClassDay] = useState('Mon');
  const classSchedule = {
    Mon: [
      { subject: 'Physics', time: '09:00 AM - 10:30 AM', teacher: 'Dr. R. K. Sen', room: 'LHC-101', status: 'Completed' },
      { subject: 'Chemistry', time: '11:00 AM - 12:30 PM', teacher: 'Prof. S. Sharma', room: 'LHC-102', status: 'Completed' },
      { subject: 'Mathematics', time: '02:00 PM - 03:30 PM', teacher: 'Dr. Anita Roy', room: 'LHC-105', status: 'Ongoing' }
    ],
    Tue: [
      { subject: 'Chemistry', time: '09:00 AM - 10:30 AM', teacher: 'Prof. S. Sharma', room: 'LHC-102', status: 'Upcoming' },
      { subject: 'English Literature', time: '11:00 AM - 12:00 PM', teacher: 'Mrs. J. Carter', room: 'LHC-201', status: 'Upcoming' },
      { subject: 'Physics Lab', time: '01:30 PM - 04:30 PM', teacher: 'Dr. R. K. Sen', room: 'Lab-A', status: 'Upcoming' }
    ],
    Wed: [
      { subject: 'Mathematics', time: '09:00 AM - 10:30 AM', teacher: 'Dr. Anita Roy', room: 'LHC-105', status: 'Upcoming' },
      { subject: 'Physics', time: '11:00 AM - 12:30 PM', teacher: 'Dr. R. K. Sen', room: 'LHC-101', status: 'Upcoming' }
    ],
    Thu: [
      { subject: 'Chemistry Lab', time: '09:00 AM - 12:00 PM', teacher: 'Prof. S. Sharma', room: 'Lab-C', status: 'Upcoming' },
      { subject: 'Mathematics', time: '02:00 PM - 03:30 PM', teacher: 'Dr. Anita Roy', room: 'LHC-105', status: 'Upcoming' }
    ],
    Fri: [
      { subject: 'Physics', time: '09:00 AM - 10:30 AM', teacher: 'Dr. R. K. Sen', room: 'LHC-101', status: 'Upcoming' },
      { subject: 'English Literature', time: '11:00 AM - 12:00 PM', teacher: 'Mrs. J. Carter', room: 'LHC-201', status: 'Upcoming' },
      { subject: 'Mathematics Seminar', time: '03:00 PM - 04:30 PM', teacher: 'Dr. Anita Roy', room: 'Auditorium', status: 'Upcoming' }
    ],
    Sat: [
      { subject: 'Weekly Mock Quiz', time: '10:00 AM - 12:00 PM', teacher: 'Evaluation Cell', room: 'Online Test', status: 'Upcoming' }
    ]
  };

  // --- STUDY MATERIALS STATES ---
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPlayState, setVideoPlayState] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0.4);
  const [materialsSearch, setMaterialsSearch] = useState('');
  
  const videoLectures = [
    { id: 'v1', title: 'Introduction to Electrostatics & Coulombs Law', subject: 'Physics', duration: '42:15', teacher: 'Dr. R. K. Sen', views: '2.5k' },
    { id: 'v2', title: 'Understanding Chemical Kinetics & Rate Laws', subject: 'Chemistry', duration: '55:30', teacher: 'Prof. S. Sharma', views: '1.8k' },
    { id: 'v3', title: 'Definite Integrals and Area Under Curve', subject: 'Mathematics', duration: '1:12:00', teacher: 'Dr. Anita Roy', views: '3.1k' },
    { id: 'v4', title: 'Gauss Law and Electric Flux Applications', subject: 'Physics', duration: '38:40', teacher: 'Dr. R. K. Sen', views: '1.2k' },
    { id: 'v5', title: 'Kinetics: Catalysts & Arrhenius Equation', subject: 'Chemistry', duration: '48:10', teacher: 'Prof. S. Sharma', views: '980' }
  ];

  const studyNotes = [
    { id: 'n1', title: 'Electrostatics Formulas & Key Concepts', subject: 'Physics', size: '2.4 MB', format: 'PDF', downloads: '1.2k' },
    { id: 'n2', title: 'Organic Chemistry: Reagent Flowcharts', subject: 'Chemistry', size: '4.8 MB', format: 'PDF', downloads: '2.5k' },
    { id: 'n3', title: 'Integral Calculus Cheat Sheet', subject: 'Mathematics', size: '1.1 MB', format: 'PDF', downloads: '3.0k' },
    { id: 'n4', title: 'Modern English Literature Summary Notes', subject: 'English', size: '850 KB', format: 'PDF', downloads: '500' }
  ];

  const dppQuestions = [
    { id: 'q1', title: 'DPP-14: Electric Fields & Force Calculations', subject: 'Physics', questions: 10, status: 'Attempted', score: '9/10' },
    { id: 'q2', title: 'DPP-15: Rate Equations & Half-Life Problems', subject: 'Chemistry', questions: 12, status: 'Pending', score: null },
    { id: 'q3', title: 'DPP-16: Integration by Parts & Substitution', subject: 'Mathematics', questions: 15, status: 'Attempted', score: '12/15' },
    { id: 'q4', title: 'DPP-17: Area under Parabola & Circles', subject: 'Mathematics', questions: 10, status: 'Pending', score: null }
  ];

  const [activeDppAttempt, setActiveDppAttempt] = useState(null);
  const [dppAnswers, setDppAnswers] = useState({});
  const [dppSubmitted, setDppSubmitted] = useState(false);

  // --- NEXUS HUB FEED STATE ---
  const [nexusPosts, setNexusPosts] = useState([
    {
      id: 'np1',
      author: 'Academic Council',
      role: 'Administrator',
      avatarLetter: 'a',
      time: '2 hours ago',
      content: 'Important Reminder: The mid-semester exam forms are online now. Please double-check your subject list and submit before June 5th, 2026 to avoid late fee penalties.',
      likes: 42,
      liked: false,
      comments: [
        { author: 'Rahul Verma', content: 'Where is the link to download exam guidelines?' },
        { author: 'Aditi Nair', content: 'Done. Very smooth process this time.' }
      ]
    },
    {
      id: 'np2',
      author: 'Physics Dept Club',
      role: 'Student Club',
      avatarLetter: 'p',
      time: '1 day ago',
      content: 'Hey Pathfinders! We are hosting a guest seminar on Astrophysics & Dark Matter this Friday at 4 PM in the Seminar Hall. Special lecture by Dr. S. Vignesh, ISRO researcher. Do not miss it!',
      likes: 120,
      liked: true,
      comments: [
        { author: 'Vikram Seth', content: 'Will we get attendance for this seminar?' },
        { author: 'Sneha Rao', content: 'Super excited! Count me in!' }
      ]
    }
  ]);
  const [newPostText, setNewPostText] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState({});

  const handleCreatePost = () => {
    if (!newPostText.trim()) return;
    const newPost = {
      id: `np-${Date.now()}`,
      author: studentData.name,
      role: 'Student',
      avatarLetter: studentData.name.charAt(0).toLowerCase(),
      time: 'Just now',
      content: newPostText.trim(),
      likes: 0,
      liked: false,
      comments: []
    };
    setNexusPosts([newPost, ...nexusPosts]);
    setNewPostText('');
  };

  const handleLikePost = (postId) => {
    setNexusPosts(nexusPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1
        };
      }
      return p;
    }));
  };

  const handleAddComment = (postId) => {
    const text = newCommentTexts[postId];
    if (!text || !text.trim()) return;
    
    setNexusPosts(nexusPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments: [...p.comments, { author: studentData.name, content: text.trim() }]
        };
      }
      return p;
    }));

    setNewCommentTexts({
      ...newCommentTexts,
      [postId]: ''
    });
  };

  // --- PROFILE EDIT STATE ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profilePhone, setProfilePhone] = useState('+1 (555) 019-2834');
  const [profileEmail, setProfileEmail] = useState('rahul.pathfinder@gmail.com');
  const [profileBloodGroup, setProfileBloodGroup] = useState('O+');

  // --- NOTICE BOARD STATE ---
  const [noticeSearch, setNoticeSearch] = useState('');
  const notices = [
    { id: 'nt1', title: 'Revised Academic Calendar for 2026-27', date: 'May 30, 2026', body: 'The academic senate has finalized the calendar. The semester classes start from August 1st, 2026 and end on December 10th, 2026.', category: 'Academic', pinned: true },
    { id: 'nt2', title: 'Hostel Outing Timings Update', date: 'May 28, 2026', body: 'Outing timings for weekends are extended till 9:30 PM. Ensure biometric verification at the main gate while entering/exiting.', category: 'Rules', pinned: false },
    { id: 'nt3', title: 'Annual Cultural Festival - Pathfinder Oasis', date: 'May 25, 2026', body: 'Oasis 2026 registrations for group dances, music bands, and theatre plays are now open. Auditions start next week.', category: 'Events', pinned: false },
    { id: 'nt4', title: 'Schedule for End-Semester Practical Exams', date: 'May 20, 2026', body: 'Practicals will be held from June 15th to June 22nd. Please check notice board inside labs for exact batch timings.', category: 'Exams', pinned: true }
  ];

  if (loading && !refreshing) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: customBg }]}>
        <ActivityIndicator size="large" color="#ff7e40" />
        <ThemedText style={{ marginTop: 12, color: textMuted }}>Syncing Student Portal...</ThemedText>
      </View>
    );
  }

  // --- SUBVIEW RENDERS ---
  const renderDashboardView = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <ThemedText style={styles.hubLabel}>STUDENT INTELLIGENCE HUB</ThemedText>
            <ThemedText style={[styles.welcomeText, { color: isDarkMode ? '#ffffff' : '#4a2d1b' }]}>
              Welcome Back, <ThemedText style={styles.orangeText}>{studentData.name}</ThemedText>!
            </ThemedText>
            <ThemedText style={[styles.heroDesc, { color: textMuted }]}>
              Your comprehensive learning snapshot is ready. We've analyzed your progress and prepared{' '}
              <ThemedText style={styles.insightsLink}>AI-powered insights</ThemedText> for your goals today.
            </ThemedText>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleRefresh}
                style={[styles.refreshBtn, { borderColor: isDarkMode ? '#ff7e40' : '#e5e7eb' }]}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#ff7e40" style={{ marginRight: 6 }} />
                ) : (
                  <FontAwesome name="refresh" size={12} color="#ff7e40" style={{ marginRight: 6 }} />
                )}
                <ThemedText style={styles.refreshBtnText}>FORCE ERP REFRESH</ThemedText>
              </Pressable>

              <View style={styles.syncIndicator}>
                <Ionicons name="time-outline" size={12} color={textMuted} style={{ marginRight: 4 }} />
                <ThemedText style={[styles.syncText, { color: textMuted }]}>LAST SYNC: JUST NOW</ThemedText>
              </View>
            </View>
          </View>

          {/* Student Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarLetter}>
                {studentData.name.charAt(0).toLowerCase()}
              </ThemedText>
              <View style={styles.activeIndicator} />
            </View>
            <View style={styles.profileDetails}>
              <ThemedText style={[styles.profileName, { color: textColor }]}>{studentData.name}</ThemedText>
              <ThemedText style={styles.enrollmentLabel}>
                ENROLLMENT - <ThemedText style={styles.enrollmentVal}>{studentData.enrollment}</ThemedText>
              </ThemedText>
              <View style={styles.classBadge}>
                <ThemedText style={styles.classBadgeText}>{studentData.className.toUpperCase()}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Stats 4-Card Grid */}
        <View style={styles.statsGrid}>
          {/* Card 1: Attendance Rate */}
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardLabel}>ATTENDANCE RATE</ThemedText>
              <Ionicons name="analytics" size={14} color="#3b82f6" />
            </View>
            <ThemedText style={[styles.cardValue, { color: textColor }]}>
              {studentData.attendance}{studentData.attendance !== '—' ? '%' : ''}
            </ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Syncing attendance...</ThemedText>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBar, { width: '85%', backgroundColor: '#3b82f6' }]} />
            </View>
            <View style={styles.greenBadge}>
              <ThemedText style={styles.greenBadgeText}>+1.2% vs last month</ThemedText>
            </View>
          </View>

          {/* Card 2: Current GPA */}
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardLabel}>CURRENT GPA</ThemedText>
              <Ionicons name="ribbon" size={14} color="#10b981" />
            </View>
            <ThemedText style={[styles.cardValue, { color: textColor }]}>
              {studentData.gpa}{studentData.gpa !== '—' ? '/10' : '/10'}
            </ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Syncing GPA...</ThemedText>
            <View style={styles.progressBarWrapper}>
              <View style={[styles.progressBar, { width: '88%', backgroundColor: '#10b981' }]} />
            </View>
            <View style={styles.grayBadge}>
              <ThemedText style={styles.grayBadgeText}>Rank: 12th</ThemedText>
            </View>
          </View>

          {/* Card 3: Next Exam */}
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardLabel}>NEXT EXAM</ThemedText>
              <Ionicons name="calendar" size={14} color="#ff7e40" />
            </View>
            <ThemedText style={[styles.examTitle, { color: textColor }]} numberOfLines={2}>
              {studentData.nextExam}
            </ThemedText>
            <ThemedText style={styles.examSpecs}>Active Now | 180 MIN</ThemedText>
            <View style={styles.ongoingBadge}>
              <ThemedText style={styles.ongoingBadgeText}>Ongoing</ThemedText>
            </View>
          </View>

          {/* Card 4: Study Streak */}
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardLabel}>STUDY STREAK</ThemedText>
              <Ionicons name="flame" size={14} color="#ec4899" />
            </View>
            <ThemedText style={[styles.cardValue, { color: textColor }]}>{studentData.streak}</ThemedText>
            <ThemedText style={styles.streakSub}>Consistent learning!</ThemedText>
            <View style={styles.streakBadge}>
              <ThemedText style={styles.streakBadgeText}>Daily Engagement</ThemedText>
            </View>
          </View>
        </View>

        {/* Analytics Section (Strong Subject & Needs Focus) */}
        <View style={styles.analyticsSection}>
          {/* Card 1: Strong Subject */}
          <View style={[styles.analyticsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.analyticsContent}>
              <ThemedText style={styles.analyticsLabel}>STRONG SUBJECT</ThemedText>
              <ThemedText style={styles.strongValue}>CHEMISTRY</ThemedText>
              <ThemedText style={styles.analyticsDesc}>High mastery in Organic reactions</ThemedText>
              <View style={styles.analysisBadge}>
                <ThemedText style={styles.analysisBadgeText}>92% Mastery Level</ThemedText>
              </View>
            </View>
            <Ionicons name="flash-outline" size={54} color="rgba(16, 185, 129, 0.08)" style={styles.watermarkIcon} />
          </View>

          {/* Card 2: Needs Focus */}
          <View style={[styles.analyticsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.analyticsContent}>
              <ThemedText style={styles.analyticsLabel}>NEEDS FOCUS</ThemedText>
              <ThemedText style={styles.focusValue}>MATHEMATICS</ThemedText>
              <ThemedText style={styles.analyticsDesc}>Integration concepts need revision</ThemedText>
              <View style={styles.focusStatusBadge}>
                <ThemedText style={styles.focusStatusText}>72% Mastery Level</ThemedText>
              </View>
            </View>
            <Ionicons name="disc-outline" size={54} color="rgba(239, 68, 68, 0.08)" style={styles.watermarkIcon} />
          </View>
        </View>

        {/* Performance Trend Chart Box */}
        <View style={[styles.chartContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.chartHeader}>
            <ThemedText style={[styles.chartTitle, { color: textColor }]}>PERFORMANCE TREND (LAST 30 DAYS)</ThemedText>
            <ThemedText style={styles.chartSub}>+12% MASTERY GROWTH</ThemedText>
          </View>

          <View style={styles.chartBox}>
            <LinearGradient
              colors={isDarkMode ? ['rgba(255,126,64,0.05)', 'rgba(255,126,64,0.15)'] : ['#fef3c7', '#fde68a']}
              style={{ flex: 1, borderRadius: 8, padding: 12, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="trending-up" size={32} color="#ff7e40" style={{ marginBottom: 4 }} />
              <ThemedText style={[styles.chartPlaceholderText, { color: isDarkMode ? '#ff7e40' : '#4a2d1b' }]}>
                ACADEMIC PERFORMANCE CURVE ACTIVE
              </ThemedText>
            </LinearGradient>
          </View>

          <View style={styles.chartLabels}>
            <ThemedText style={styles.chartLabelText}>PAST</ThemedText>
            <ThemedText style={styles.chartLabelText}>RECENT</ThemedText>
            <ThemedText style={styles.chartLabelText}>TODAY</ThemedText>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderNexusView = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>NEXUS HUB</ThemedText>
          <ThemedText style={styles.sectionSub}>Engage with your peer community and administration</ThemedText>
        </View>

        <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.cardInputLabel}>SHARE SOMETHING WITH THE HUB</ThemedText>
          <TextInput
            style={[styles.textAreaInput, { color: textColor, borderColor: cardBorder }]}
            placeholder="Type announcements, notes or requests..."
            placeholderTextColor={textMuted}
            multiline
            numberOfLines={3}
            value={newPostText}
            onChangeText={setNewPostText}
          />
          <Pressable style={styles.postBtn} onPress={handleCreatePost}>
            <Ionicons name="send-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <ThemedText style={styles.postBtnText}>POST TO FEED</ThemedText>
          </Pressable>
        </View>

        {nexusPosts.map((post) => (
          <View key={post.id} style={[styles.feedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.feedCardHeader}>
              <View style={styles.avatarSmall}>
                <ThemedText style={styles.avatarSmallLetter}>{post.avatarLetter}</ThemedText>
              </View>
              <View style={styles.feedAuthorInfo}>
                <ThemedText style={[styles.feedAuthorName, { color: textColor }]}>{post.author}</ThemedText>
                <ThemedText style={styles.feedAuthorRole}>{post.role.toUpperCase()} • {post.time}</ThemedText>
              </View>
            </View>

            <ThemedText style={[styles.feedContentText, { color: textColor }]}>{post.content}</ThemedText>

            <View style={[styles.feedActionRow, { borderTopColor: cardBorder, borderBottomColor: cardBorder }]}>
              <Pressable style={styles.feedActionBtn} onPress={() => handleLikePost(post.id)}>
                <Ionicons 
                  name={post.liked ? 'heart' : 'heart-outline'} 
                  size={16} 
                  color={post.liked ? '#ef4444' : textMuted} 
                />
                <ThemedText style={[styles.feedActionText, { color: post.liked ? '#ef4444' : textMuted }]}>
                  {post.likes} Likes
                </ThemedText>
              </Pressable>

              <View style={styles.feedActionBtn}>
                <Ionicons name="chatbox-outline" size={16} color={textMuted} />
                <ThemedText style={[styles.feedActionText, { color: textMuted }]}>
                  {post.comments.length} Comments
                </ThemedText>
              </View>
            </View>

            {post.comments.map((comment, index) => (
              <View key={index} style={styles.commentItem}>
                <ThemedText style={[styles.commentAuthor, { color: textColor }]}>{comment.author}: </ThemedText>
                <ThemedText style={[styles.commentContent, { color: textMuted }]}>{comment.content}</ThemedText>
              </View>
            ))}

            <View style={styles.addCommentRow}>
              <TextInput
                style={[styles.commentTextInput, { color: textColor, borderColor: cardBorder }]}
                placeholder="Write a comment..."
                placeholderTextColor={textMuted}
                value={newCommentTexts[post.id] || ''}
                onChangeText={(val) => setNewCommentTexts({ ...newCommentTexts, [post.id]: val })}
              />
              <Pressable 
                style={styles.commentSendBtn} 
                onPress={() => handleAddComment(post.id)}
              >
                <Ionicons name="arrow-forward-outline" size={14} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const saveProfileChanges = () => {
    setIsEditingProfile(false);
    Alert.alert('Success', 'Profile details updated successfully.');
  };

  const renderProfileView = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>MY PROFILE</ThemedText>
          <ThemedText style={styles.sectionSub}>View and update your academic portal details</ThemedText>
        </View>

        <View style={[styles.profileViewHeaderCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.largeAvatar}>
            <ThemedText style={styles.largeAvatarLetter}>
              {studentData.name.charAt(0).toLowerCase()}
            </ThemedText>
          </View>
          <ThemedText style={[styles.largeProfileName, { color: textColor }]}>{studentData.name}</ThemedText>
          <ThemedText style={styles.largeEnrollment}>{studentData.enrollment}</ThemedText>
          <View style={styles.largeClassBadge}>
            <ThemedText style={styles.largeClassBadgeText}>{studentData.className.toUpperCase()}</ThemedText>
          </View>
        </View>

        <Pressable 
          style={[styles.profileEditBtn, { borderColor: '#ff7e40' }]} 
          onPress={() => isEditingProfile ? saveProfileChanges() : setIsEditingProfile(true)}
        >
          <Ionicons name={isEditingProfile ? "save-outline" : "create-outline"} size={14} color="#ff7e40" style={{ marginRight: 6 }} />
          <ThemedText style={styles.profileEditBtnText}>
            {isEditingProfile ? 'SAVE CHANGES' : 'EDIT CONTACT DETAILS'}
          </ThemedText>
        </Pressable>

        <View style={[styles.detailGroupCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.detailGroupHeader}>ACADEMIC SUMMARY</ThemedText>
          
          <View style={[styles.detailItemRow, { borderBottomColor: cardBorder }]}>
            <ThemedText style={styles.detailItemLabel}>Class Level</ThemedText>
            <ThemedText style={[styles.detailItemValue, { color: textColor }]}>{studentData.className}</ThemedText>
          </View>

          <View style={[styles.detailItemRow, { borderBottomColor: cardBorder }]}>
            <ThemedText style={styles.detailItemLabel}>Section / Batch</ThemedText>
            <ThemedText style={[styles.detailItemValue, { color: textColor }]}>Batch A - Morning</ThemedText>
          </View>

          <View style={styles.detailItemRow}>
            <ThemedText style={styles.detailItemLabel}>Academic Advisor</ThemedText>
            <ThemedText style={[styles.detailItemValue, { color: textColor }]}>Dr. R. K. Sen</ThemedText>
          </View>
        </View>

        <View style={[styles.detailGroupCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.detailGroupHeader}>CONTACT INFORMATION</ThemedText>
          
          <View style={[styles.detailItemRow, { borderBottomColor: cardBorder }]}>
            <ThemedText style={styles.detailItemLabel}>Registered Email</ThemedText>
            {isEditingProfile ? (
              <TextInput
                style={[styles.profileEditInput, { color: textColor, borderColor: cardBorder }]}
                value={profileEmail}
                onChangeText={setProfileEmail}
              />
            ) : (
              <ThemedText style={[styles.detailItemValue, { color: textColor }]}>{profileEmail}</ThemedText>
            )}
          </View>

          <View style={[styles.detailItemRow, { borderBottomColor: cardBorder }]}>
            <ThemedText style={styles.detailItemLabel}>Mobile Number</ThemedText>
            {isEditingProfile ? (
              <TextInput
                style={[styles.profileEditInput, { color: textColor, borderColor: cardBorder }]}
                value={profilePhone}
                onChangeText={setProfilePhone}
              />
            ) : (
              <ThemedText style={[styles.detailItemValue, { color: textColor }]}>{profilePhone}</ThemedText>
            )}
          </View>

          <View style={styles.detailItemRow}>
            <ThemedText style={styles.detailItemLabel}>Blood Group</ThemedText>
            {isEditingProfile ? (
              <TextInput
                style={[styles.profileEditInput, { color: textColor, borderColor: cardBorder }]}
                value={profileBloodGroup}
                onChangeText={setProfileBloodGroup}
              />
            ) : (
              <ThemedText style={[styles.detailItemValue, { color: textColor }]}>{profileBloodGroup}</ThemedText>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderClassesView = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentSchedule = classSchedule[selectedClassDay] || [];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>CLASSES & SCHEDULE</ThemedText>
          <ThemedText style={styles.sectionSub}>Manage and view daily lecture timetables</ThemedText>
        </View>

        <View style={styles.daySelectorRow}>
          {days.map((day) => {
            const isSelected = selectedClassDay === day;
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedClassDay(day)}
                style={[
                  styles.daySelectorBtn,
                  isSelected && styles.daySelectorBtnActive,
                  { borderColor: cardBorder }
                ]}
              >
                <ThemedText style={[
                  styles.daySelectorText,
                  isSelected && styles.daySelectorTextActive
                ]}>
                  {day}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {currentSchedule.length === 0 ? (
          <View style={[styles.emptyStateCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="calendar-outline" size={32} color={textMuted} />
            <ThemedText style={[styles.emptyStateText, { color: textMuted }]}>No lectures scheduled for this day.</ThemedText>
          </View>
        ) : (
          currentSchedule.map((cls, idx) => (
            <View key={idx} style={[styles.classLectureCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.classCardTop}>
                <View style={styles.classSubjectWrapper}>
                  <ThemedText style={[styles.classSubjectText, { color: textColor }]}>{cls.subject}</ThemedText>
                  <ThemedText style={styles.classTeacherText}>{cls.teacher}</ThemedText>
                </View>
                
                <View style={[
                  styles.classStatusBadge,
                  cls.status === 'Completed' && styles.statusCompletedBg,
                  cls.status === 'Ongoing' && styles.statusOngoingBg,
                  cls.status === 'Upcoming' && styles.statusUpcomingBg,
                ]}>
                  <ThemedText style={[
                    styles.classStatusText,
                    cls.status === 'Completed' && styles.statusCompletedText,
                    cls.status === 'Ongoing' && styles.statusOngoingText,
                    cls.status === 'Upcoming' && styles.statusUpcomingText,
                  ]}>
                    {cls.status}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.classCardDivider, { backgroundColor: cardBorder }]} />

              <View style={styles.classCardBottom}>
                <View style={styles.classDetailCol}>
                  <Ionicons name="time-outline" size={12} color={textMuted} />
                  <ThemedText style={[styles.classDetailText, { color: textMuted }]}>{cls.time}</ThemedText>
                </View>

                <View style={styles.classDetailCol}>
                  <Ionicons name="location-outline" size={12} color={textMuted} />
                  <ThemedText style={[styles.classDetailText, { color: textMuted }]}>{cls.room}</ThemedText>
                </View>
              </View>

              {cls.status === 'Ongoing' && (
                <Pressable 
                  style={styles.joinClassBtn} 
                  onPress={() => Alert.alert('Joining Room', `Connecting to live streaming session for ${cls.subject}...`)}
                >
                  <Ionicons name="play-circle-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.joinClassBtnText}>JOIN CLASSROOM NOW</ThemedText>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderAttendanceView = () => {
    const attendanceLogs = [
      { date: 'May 30, 2026', status: 'Present', details: 'Lecture LHC-101, LHC-102, LHC-105' },
      { date: 'May 29, 2026', status: 'Present', details: 'Lecture LHC-102, LHC-201' },
      { date: 'May 28, 2026', status: 'Present', details: 'Lecture LHC-105, LHC-101' },
      { date: 'May 27, 2026', status: 'Absent', details: 'Missed lectures due to emergency' },
      { date: 'May 26, 2026', status: 'Present', details: 'Lecture LHC-101, LHC-102, LHC-105' },
      { date: 'May 25, 2026', status: 'Leave', details: 'Approved Medical Leave request' },
      { date: 'May 24, 2026', status: 'Sunday', details: 'Campus Holiday' }
    ];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>ATTENDANCE LOGS</ThemedText>
          <ThemedText style={styles.sectionSub}>Track and audit your classroom participation logs</ThemedText>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={styles.cardLabel}>TOTAL PRESENT</ThemedText>
            <ThemedText style={[styles.cardValue, { color: textColor }]}>18</ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Sessions attended</ThemedText>
          </View>

          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={styles.cardLabel}>TOTAL ABSENT</ThemedText>
            <ThemedText style={[styles.cardValue, { color: '#ef4444' }]}>2</ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Unexcused absences</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.subheadingTitle}>ATTENDANCE REGISTRY LOG</ThemedText>
        
        {attendanceLogs.map((log, idx) => (
          <View key={idx} style={[styles.attendanceRegistryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.attendanceLeft}>
              <View style={[
                styles.attendanceDot,
                log.status === 'Present' && { backgroundColor: '#10b981' },
                log.status === 'Absent' && { backgroundColor: '#ef4444' },
                log.status === 'Leave' && { backgroundColor: '#ff7e40' },
                log.status === 'Sunday' && { backgroundColor: '#8b9bb4' }
              ]} />
              <View>
                <ThemedText style={[styles.attendanceDateText, { color: textColor }]}>{log.date}</ThemedText>
                <ThemedText style={styles.attendanceDetailsText}>{log.details}</ThemedText>
              </View>
            </View>

            <View style={[
              styles.attendanceStatusBadge,
              log.status === 'Present' && { backgroundColor: 'rgba(16,185,129,0.1)' },
              log.status === 'Absent' && { backgroundColor: 'rgba(239,68,68,0.1)' },
              log.status === 'Leave' && { backgroundColor: 'rgba(255,126,64,0.1)' },
              log.status === 'Sunday' && { backgroundColor: 'rgba(255,255,255,0.05)' }
            ]}>
              <ThemedText style={[
                styles.attendanceStatusText,
                log.status === 'Present' && { color: '#10b981' },
                log.status === 'Absent' && { color: '#ef4444' },
                log.status === 'Leave' && { color: '#ff7e40' },
                log.status === 'Sunday' && { color: '#8b9bb4' }
              ]}>
                {log.status}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderExamsView = () => {
    const upcomingExams = [
      { id: 'e1', name: 'Physics Part-1: Electrostatics Test', date: 'June 6, 2026', time: '10:00 AM - 11:30 AM', duration: '90 MIN', marks: '50' },
      { id: 'e2', name: 'Chemistry Mid-Semester Theory Exam', date: 'June 10, 2026', time: '09:00 AM - 12:00 PM', duration: '180 MIN', marks: '100' },
      { id: 'e3', name: 'Mathematics Practical Viva Voce', date: 'June 18, 2026', time: '01:30 PM - 04:30 PM', duration: '180 MIN', marks: '50' }
    ];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>EXAMINATIONS</ThemedText>
          <ThemedText style={styles.sectionSub}>Review examination dates and study syllabus sheets</ThemedText>
        </View>

        {upcomingExams.map((exam) => (
          <View key={exam.id} style={[styles.examCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.examCardHeader}>
              <Ionicons name="document-text-outline" size={24} color="#ff7e40" />
              <View style={styles.examCardTitleCol}>
                <ThemedText style={[styles.examCardName, { color: textColor }]}>{exam.name}</ThemedText>
                <ThemedText style={styles.examCardDateText}>{exam.date}</ThemedText>
              </View>
            </View>

            <View style={[styles.examSpecsRow, { borderColor: cardBorder }]}>
              <View style={styles.examSpecItem}>
                <ThemedText style={styles.examSpecLabel}>TIME</ThemedText>
                <ThemedText style={[styles.examSpecVal, { color: textColor }]}>{exam.time}</ThemedText>
              </View>
              <View style={styles.examSpecItem}>
                <ThemedText style={styles.examSpecLabel}>DURATION</ThemedText>
                <ThemedText style={[styles.examSpecVal, { color: textColor }]}>{exam.duration}</ThemedText>
              </View>
              <View style={styles.examSpecItem}>
                <ThemedText style={styles.examSpecLabel}>MAX MARKS</ThemedText>
                <ThemedText style={[styles.examSpecVal, { color: textColor }]}>{exam.marks}</ThemedText>
              </View>
            </View>

            <Pressable 
              style={[styles.examActionBtn, { borderColor: '#ff7e40' }]} 
              onPress={() => Alert.alert('Download Started', `Downloading syllabus details file for: ${exam.name}`)}
            >
              <Ionicons name="download-outline" size={14} color="#ff7e40" style={{ marginRight: 6 }} />
              <ThemedText style={styles.examActionBtnText}>DOWNLOAD SYLLABUS</ThemedText>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderResultsView = () => {
    const termResults = [
      { subject: 'Physics Theory', marks: '86', maxMarks: '100', grade: 'A', status: 'Pass' },
      { subject: 'Chemistry Theory', marks: '92', maxMarks: '100', grade: 'A+', status: 'Pass' },
      { subject: 'Mathematics Core', marks: '78', maxMarks: '100', grade: 'B+', status: 'Pass' },
      { subject: 'English Communication', marks: '88', maxMarks: '100', grade: 'A', status: 'Pass' },
      { subject: 'Physics Practical Lab', marks: '45', maxMarks: '50', grade: 'A+', status: 'Pass' }
    ];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>ACADEMIC RESULTS</ThemedText>
          <ThemedText style={styles.sectionSub}>Inspect grade summary sheets for current semester evaluation</ThemedText>
        </View>

        <View style={[styles.resultsGPAHeaderCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.gpaHeaderLabel}>CUMULATIVE GRADE POINT AVERAGE</ThemedText>
          <ThemedText style={[styles.gpaHeaderValue, { color: '#ff7e40' }]}>8.72 / 10</ThemedText>
          <View style={styles.gpaBadgeRow}>
            <View style={styles.gpaSubBadge}>
              <ThemedText style={styles.gpaSubBadgeText}>RANK: 12th IN CLASS</ThemedText>
            </View>
            <View style={[styles.gpaSubBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <ThemedText style={[styles.gpaSubBadgeText, { color: '#10b981' }]}>PASS STATUS: ACTIVE</ThemedText>
            </View>
          </View>
        </View>

        {termResults.map((res, idx) => {
          const marksPct = Math.round((parseInt(res.marks) / parseInt(res.maxMarks)) * 100);
          return (
            <View key={idx} style={[styles.resultSubjectCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.resultSubjectTop}>
                <View>
                  <ThemedText style={[styles.resultSubjectTitle, { color: textColor }]}>{res.subject}</ThemedText>
                  <ThemedText style={styles.resultMarksLabel}>MARKS: {res.marks} / {res.maxMarks}</ThemedText>
                </View>

                <View style={styles.resultGradeCircle}>
                  <ThemedText style={styles.resultGradeText}>{res.grade}</ThemedText>
                </View>
              </View>

              <View style={styles.resultSubjectProgressWrapper}>
                <View style={[styles.resultSubjectProgressBar, { width: `${marksPct}%`, backgroundColor: marksPct >= 85 ? '#10b981' : '#ff7e40' }]} />
              </View>

              <View style={styles.resultSubjectBottom}>
                <ThemedText style={styles.resultPercentageText}>{marksPct}% Score</ThemedText>
                <ThemedText style={styles.resultStatusText}>{res.status.toUpperCase()}</ThemedText>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderVideoContentView = () => {
    const filteredVideos = videoLectures.filter(video => 
      video.title.toLowerCase().includes(materialsSearch.toLowerCase()) ||
      video.subject.toLowerCase().includes(materialsSearch.toLowerCase())
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>VIDEO CONTENT</ThemedText>
          <ThemedText style={styles.sectionSub}>Watch conceptual lectures and video lessons</ThemedText>
        </View>

        {selectedVideo ? (
          <View style={[styles.videoPlayerCard, { backgroundColor: '#070a13', borderColor: cardBorder }]}>
            <View style={styles.videoMockScreen}>
              <Ionicons 
                name={videoPlayState ? "pause-circle" : "play-circle"} 
                size={64} 
                color="#ff7e40" 
                onPress={() => setVideoPlayState(!videoPlayState)} 
              />
              <ThemedText style={styles.videoPlayerTimeText}>
                {videoPlayState ? 'STREAMING LIVE' : 'STREAM PAUSED'}
              </ThemedText>
            </View>

            <View style={styles.videoPlayerControls}>
              <ThemedText style={styles.videoPlayingTitle} numberOfLines={1}>{selectedVideo.title}</ThemedText>
              <ThemedText style={styles.videoPlayingTeacher}>{selectedVideo.teacher} • {selectedVideo.duration}</ThemedText>
              
              <View style={styles.videoPlayerSeekBarWrapper}>
                <View style={[styles.videoPlayerSeekBar, { width: `${videoProgress * 100}%` }]} />
              </View>

              <View style={styles.videoPlayerBtnRow}>
                <Pressable style={styles.videoClosePlayerBtn} onPress={() => { setSelectedVideo(null); setVideoPlayState(false); }}>
                  <ThemedText style={styles.videoClosePlayerText}>CLOSE PLAYER</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.searchBoxWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="search" size={16} color={textMuted} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search lectures by title or topic..."
            placeholderTextColor={textMuted}
            value={materialsSearch}
            onChangeText={setMaterialsSearch}
          />
        </View>

        {filteredVideos.map((video) => (
          <Pressable 
            key={video.id} 
            style={[styles.videoLectureCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            onPress={() => { setSelectedVideo(video); setVideoPlayState(true); }}
          >
            <View style={styles.videoLectureLeft}>
              <View style={styles.videoIconBg}>
                <Ionicons name="play" size={18} color="#ff7e40" />
              </View>
              <View style={styles.videoTextCol}>
                <ThemedText style={[styles.videoTitleText, { color: textColor }]} numberOfLines={1}>{video.title}</ThemedText>
                <ThemedText style={styles.videoTeacherText}>{video.teacher} • {video.duration}</ThemedText>
              </View>
            </View>

            <View style={styles.videoBadgeCol}>
              <View style={styles.subjectBadge}>
                <ThemedText style={styles.subjectBadgeText}>{video.subject.toUpperCase()}</ThemedText>
              </View>
              <ThemedText style={styles.videoViewsText}>{video.views} views</ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const renderNotesView = () => {
    const filteredNotes = studyNotes.filter(note => 
      note.title.toLowerCase().includes(materialsSearch.toLowerCase()) ||
      note.subject.toLowerCase().includes(materialsSearch.toLowerCase())
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>STUDY NOTES</ThemedText>
          <ThemedText style={styles.sectionSub}>Download PDF hand-outs and formula cheat sheets</ThemedText>
        </View>

        <View style={[styles.searchBoxWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="search" size={16} color={textMuted} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search notes files..."
            placeholderTextColor={textMuted}
            value={materialsSearch}
            onChangeText={setMaterialsSearch}
          />
        </View>

        {filteredNotes.map((note) => (
          <View key={note.id} style={[styles.notesCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.notesCardLeft}>
              <View style={styles.pdfIconBg}>
                <Ionicons name="document-text" size={20} color="#ef4444" />
              </View>
              <View style={styles.notesTextCol}>
                <ThemedText style={[styles.notesTitleText, { color: textColor }]} numberOfLines={1}>{note.title}</ThemedText>
                <ThemedText style={styles.notesSpecsText}>{note.subject} • {note.size} • {note.format}</ThemedText>
              </View>
            </View>

            <Pressable 
              style={styles.notesDownloadBtn}
              onPress={() => Alert.alert('File Saved', `PDF Document downloaded successfully: ${note.title}`)}
            >
              <Ionicons name="arrow-down-circle" size={24} color="#ff7e40" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderDppQuestionsView = () => {
    if (activeDppAttempt) {
      const questions = [
        {
          q: "1. If a particle has constant positive acceleration, what is the shape of its position-time graph?",
          opt: ["A) Straight diagonal line", "B) Parabola opening upwards", "C) Parabola opening downwards", "D) Sinusoidal curve"],
          ans: 1
        },
        {
          q: "2. Which of the following defines electric flux through a surface?",
          opt: ["A) ∫ E • dA", "B) ∫ E x dA", "C) E / q", "D) q / E"],
          ans: 0
        },
        {
          q: "3. What is the derivative of x^x with respect to x?",
          opt: ["A) x * x^(x-1)", "B) x^x * (1 + ln x)", "C) x^x * ln x", "D) e^x"],
          ans: 1
        }
      ];

      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>{activeDppAttempt.title.toUpperCase()}</ThemedText>
            <ThemedText style={styles.sectionSub}>Multiple choice practice questionnaire</ThemedText>
          </View>

          {questions.map((qObj, qIdx) => (
            <View key={qIdx} style={[styles.quizQuestionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ThemedText style={[styles.quizQuestionText, { color: textColor }]}>{qObj.q}</ThemedText>
              
              <View style={styles.quizOptionsList}>
                {qObj.opt.map((optStr, optIdx) => {
                  const isSelected = dppAnswers[qIdx] === optIdx;
                  const isCorrect = qObj.ans === optIdx;
                  
                  let optStyle = styles.quizOptionBtn;
                  let optText = styles.quizOptionText;
                  
                  if (isSelected) {
                    optStyle = [styles.quizOptionBtn, styles.quizOptionSelected];
                    optText = [styles.quizOptionText, styles.quizOptionSelectedText];
                  }
                  
                  if (dppSubmitted) {
                    if (isCorrect) {
                      optStyle = [styles.quizOptionBtn, styles.quizOptionCorrect];
                      optText = [styles.quizOptionText, styles.quizOptionCorrectText];
                    } else if (isSelected) {
                      optStyle = [styles.quizOptionBtn, styles.quizOptionWrong];
                      optText = [styles.quizOptionText, styles.quizOptionWrongText];
                    }
                  }

                  return (
                    <Pressable
                      key={optIdx}
                      disabled={dppSubmitted}
                      style={optStyle}
                      onPress={() => handleSelectDppAns(qIdx, optIdx)}
                    >
                      <ThemedText style={optText}>{optStr}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {dppSubmitted ? (
            <View style={[styles.quizResultsSummaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ThemedText style={styles.quizSummaryTitle}>SCORE ANALYSIS</ThemedText>
              
              {(() => {
                let correctCount = 0;
                questions.forEach((q, idx) => {
                  if (dppAnswers[idx] === q.ans) correctCount++;
                });
                return (
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <ThemedText style={[styles.quizScoreVal, { color: '#ff7e40' }]}>
                      {correctCount} / {questions.length} Correct
                    </ThemedText>
                    <ThemedText style={styles.quizStatusDesc}>
                      {correctCount === questions.length ? 'Excellent Work! 100% Mastery' : 'Good attempt. Review incorrect options.'}
                    </ThemedText>
                  </View>
                );
              })()}

              <Pressable style={styles.quizResetBtn} onPress={() => setActiveDppAttempt(null)}>
                <ThemedText style={styles.quizResetBtnText}>BACK TO DPP LIST</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.quizSubmitBtn} onPress={submitDppTest}>
              <ThemedText style={styles.quizSubmitBtnText}>SUBMIT TEST</ThemedText>
            </Pressable>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>DPP PROBLEMS</ThemedText>
          <ThemedText style={styles.sectionSub}>Attempt Daily Practice Problems and receive grades</ThemedText>
        </View>

        {dppQuestions.map((dpp) => (
          <View key={dpp.id} style={[styles.dppCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.dppCardLeft}>
              <View style={styles.dppCodeIconBg}>
                <Ionicons name="checkbox-outline" size={16} color="#ff7e40" />
              </View>
              <View style={styles.dppTextCol}>
                <ThemedText style={[styles.dppTitleText, { color: textColor }]} numberOfLines={1}>{dpp.title}</ThemedText>
                <ThemedText style={styles.dppSpecsText}>
                  {dpp.subject} • {dpp.questions} MCQ Questions
                </ThemedText>
              </View>
            </View>

            <View style={styles.dppActionCol}>
              {dpp.status === 'Attempted' ? (
                <View style={styles.dppScoreBadge}>
                  <ThemedText style={styles.dppScoreText}>{dpp.score}</ThemedText>
                </View>
              ) : (
                <Pressable style={styles.dppAttemptBtn} onPress={() => handleStartDpp(dpp)}>
                  <ThemedText style={styles.dppAttemptBtnText}>ATTEMPT</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderPerformanceView = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>PERFORMANCE REPORT</ThemedText>
          <ThemedText style={styles.sectionSub}>Analyze test grades and subject-wise mastery trends</ThemedText>
        </View>

        <View style={[styles.metricHighlightCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.metricLabel}>AVERAGE EXAM SCORE</ThemedText>
          <ThemedText style={[styles.metricValue, { color: '#ff7e40' }]}>88.4%</ThemedText>
          <ThemedText style={styles.metricChangeGreen}>+4.6% vs previous quarter</ThemedText>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={[styles.chartTitle, { color: textColor }]}>QUIZ PERFORMANCE HISTORY</ThemedText>
          
          <View style={styles.performanceMockChartContainer}>
            <View style={styles.chartBarCol}>
              <View style={[styles.chartBarSolid, { height: '80%', backgroundColor: '#ff7e40' }]} />
              <ThemedText style={styles.chartBarLabel}>Q1</ThemedText>
            </View>
            <View style={styles.chartBarCol}>
              <View style={[styles.chartBarSolid, { height: '70%', backgroundColor: '#3b82f6' }]} />
              <ThemedText style={styles.chartBarLabel}>Q2</ThemedText>
            </View>
            <View style={styles.chartBarCol}>
              <View style={[styles.chartBarSolid, { height: '90%', backgroundColor: '#10b981' }]} />
              <ThemedText style={styles.chartBarLabel}>Q3</ThemedText>
            </View>
            <View style={styles.chartBarCol}>
              <View style={[styles.chartBarSolid, { height: '85%', backgroundColor: '#ec4899' }]} />
              <ThemedText style={styles.chartBarLabel}>Q4</ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={[styles.chartTitle, { color: textColor }]}>SUBJECT STRENGTH MATRIX</ThemedText>
          
          <View style={styles.matrixRow}>
            <ThemedText style={[styles.matrixSubject, { color: textColor }]}>Physics</ThemedText>
            <View style={styles.matrixBarBg}>
              <View style={[styles.matrixBarFill, { width: '85%', backgroundColor: '#10b981' }]} />
            </View>
            <ThemedText style={styles.matrixPct}>85%</ThemedText>
          </View>

          <View style={styles.matrixRow}>
            <ThemedText style={[styles.matrixSubject, { color: textColor }]}>Chemistry</ThemedText>
            <View style={styles.matrixBarBg}>
              <View style={[styles.matrixBarFill, { width: '92%', backgroundColor: '#10b981' }]} />
            </View>
            <ThemedText style={styles.matrixPct}>92%</ThemedText>
          </View>

          <View style={styles.matrixRow}>
            <ThemedText style={[styles.matrixSubject, { color: textColor }]}>Mathematics</ThemedText>
            <View style={styles.matrixBarBg}>
              <View style={[styles.matrixBarFill, { width: '72%', backgroundColor: '#ff7e40' }]} />
            </View>
            <ThemedText style={styles.matrixPct}>72%</ThemedText>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderAnalyticsView = () => {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>ADVANCED ANALYTICS</ThemedText>
          <ThemedText style={styles.sectionSub}>AI-powered study analysis and weak-topic diagnostics</ThemedText>
        </View>

        <View style={[styles.analyticsFeatureCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="sparkles" size={24} color="#ff7e40" />
          <ThemedText style={[styles.analyticsFeatureTitle, { color: textColor }]}>AI COGNITIVE PROFILE</ThemedText>
          <ThemedText style={styles.analyticsFeatureBody}>
            Based on your quiz submissions, your conceptual clarity in **Organic Reactions** is strong, but your problem solving speed in **Integral Calculus** needs revision.
          </ThemedText>
          <View style={styles.recommendationBadge}>
            <ThemedText style={styles.recommendationText}>REMEDIATION PLAN GENERATED</ThemedText>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={styles.cardLabel}>SOLVING ACCURACY</ThemedText>
            <ThemedText style={[styles.cardValue, { color: '#10b981' }]}>91.2%</ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Top 5% of class</ThemedText>
          </View>

          <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={styles.cardLabel}>AVERAGE SPEED</ThemedText>
            <ThemedText style={[styles.cardValue, { color: '#ff7e40' }]}>1.4 min</ThemedText>
            <ThemedText style={styles.cardStatusMuted}>Per question limit</ThemedText>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={[styles.chartTitle, { color: textColor }]}>RECOMMENDED STUDY FOCUS AREAS</ThemedText>
          
          <View style={styles.focusTopicItem}>
            <Ionicons name="arrow-redo" size={14} color="#ff7e40" />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.focusTopicTitle, { color: textColor }]}>Definite Integration: Substitution Rule</ThemedText>
              <ThemedText style={styles.focusTopicDesc}>Read Mathematics Note #3 and practice DPP-16</ThemedText>
            </View>
          </View>

          <View style={styles.focusTopicItem}>
            <Ionicons name="arrow-redo" size={14} color="#ff7e40" />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.focusTopicTitle, { color: textColor }]}>Arrhenius Equation & Rates</ThemedText>
              <ThemedText style={styles.focusTopicDesc}>Watch Chemistry Video Lecture #5</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderGrievancesView = () => {
    const categories = ['Academic', 'Hostel', 'Transport', 'Fee/Finance', 'Technical', 'Other'];
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>GRIEVANCE PORTAL</ThemedText>
          <ThemedText style={styles.sectionSub}>Log and monitor formal requests or complaints</ThemedText>
        </View>

        <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.cardInputLabel}>SUBMIT NEW GRIEVANCE TICKET</ThemedText>
          
          <ThemedText style={styles.inputFieldLabel}>SELECT CATEGORY</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBadgeScroll}>
            {categories.map((cat) => {
              const isSelected = grievanceCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setGrievanceCategory(cat)}
                  style={[
                    styles.catBadgeItem,
                    isSelected && styles.catBadgeItemActive,
                    { borderColor: cardBorder }
                  ]}
                >
                  <ThemedText style={[styles.catBadgeText, isSelected && styles.catBadgeTextActive]}>
                    {cat}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ThemedText style={styles.inputFieldLabel}>SUBJECT SUMMARY</ThemedText>
          <TextInput
            style={[styles.singleLineInput, { color: textColor, borderColor: cardBorder }]}
            placeholder="E.g. Classroom projector breakdown..."
            placeholderTextColor={textMuted}
            value={grievanceSubject}
            onChangeText={setGrievanceSubject}
          />

          <ThemedText style={styles.inputFieldLabel}>DETAILED COMPLAINT / FEEDBACK DESCRIPTION</ThemedText>
          <TextInput
            style={[styles.textAreaInput, { color: textColor, borderColor: cardBorder }]}
            placeholder="Provide relevant names, dates, or technical descriptions..."
            placeholderTextColor={textMuted}
            multiline
            numberOfLines={4}
            value={grievanceDesc}
            onChangeText={setGrievanceDesc}
          />

          <Pressable style={styles.postBtn} onPress={submitGrievance}>
            <Ionicons name="checkbox-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <ThemedText style={styles.postBtnText}>SUBMIT FORM TICKET</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.subheadingTitle}>LOGGED TICKETS HISTORY</ThemedText>
        {grievancesList.map((t) => (
          <View key={t.id} style={[styles.ticketCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.ticketCardTop}>
              <View>
                <ThemedText style={[styles.ticketSubject, { color: textColor }]}>{t.subject}</ThemedText>
                <ThemedText style={styles.ticketMetaText}>{t.category} • {t.id} • {t.date}</ThemedText>
              </View>

              <View style={[
                styles.ticketStatusBadge,
                t.status === 'Resolved' && { backgroundColor: 'rgba(16,185,129,0.1)' },
                t.status === 'In Progress' && { backgroundColor: 'rgba(255,126,64,0.1)' },
                t.status === 'Pending' && { backgroundColor: 'rgba(239,68,68,0.1)' }
              ]}>
                <ThemedText style={[
                  styles.ticketStatusText,
                  t.status === 'Resolved' && { color: '#10b981' },
                  t.status === 'In Progress' && { color: '#ff7e40' },
                  t.status === 'Pending' && { color: '#ef4444' }
                ]}>
                  {t.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            
            <ThemedText style={[styles.ticketDescriptionText, { color: textMuted }]}>{t.description}</ThemedText>

            {t.resolution && (
              <View style={[styles.resolutionBox, { backgroundColor: isDarkMode ? '#0d131f' : '#f3f4f6' }]}>
                <ThemedText style={[styles.resolutionTitle, { color: textColor }]}>RESOLUTION ADVISORY:</ThemedText>
                <ThemedText style={[styles.resolutionBody, { color: textMuted }]}>{t.resolution}</ThemedText>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderDoubtsView = () => {
    const subjects = ['Physics', 'Chemistry', 'Mathematics', 'English'];
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>ASK A DOUBT</ThemedText>
          <ThemedText style={styles.sectionSub}>Post a conceptual query to receive explanations from faculty tutors</ThemedText>
        </View>

        <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.cardInputLabel}>ASK NEW DOUBT QUESTION</ThemedText>
          
          <ThemedText style={styles.inputFieldLabel}>SELECT SUBJECT AREA</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBadgeScroll}>
            {subjects.map((sub) => {
              const isSelected = doubtSubject === sub;
              return (
                <Pressable
                  key={sub}
                  onPress={() => setDoubtSubject(sub)}
                  style={[
                    styles.catBadgeItem,
                    isSelected && styles.catBadgeItemActive,
                    { borderColor: cardBorder }
                  ]}
                >
                  <ThemedText style={[styles.catBadgeText, isSelected && styles.catBadgeTextActive]}>
                    {sub}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ThemedText style={styles.inputFieldLabel}>TYPE YOUR QUESTION IN DETAILS</ThemedText>
          <TextInput
            style={[styles.textAreaInput, { color: textColor, borderColor: cardBorder }]}
            placeholder="Type your mathematics equation, physics concept or doubt description here..."
            placeholderTextColor={textMuted}
            multiline
            numberOfLines={4}
            value={doubtQuestion}
            onChangeText={setDoubtQuestion}
          />

          <Pressable style={styles.postBtn} onPress={submitDoubt}>
            <Ionicons name="help-circle-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <ThemedText style={styles.postBtnText}>POST DOUBT QUERY</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.subheadingTitle}>YOUR LOGGED QUESTIONNAIRE</ThemedText>
        {doubtsList.map((d) => (
          <View key={d.id} style={[styles.ticketCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.ticketCardTop}>
              <View>
                <View style={styles.classBadge}>
                  <ThemedText style={styles.classBadgeText}>{d.subject.toUpperCase()}</ThemedText>
                </View>
                <ThemedText style={styles.ticketMetaText}>{d.date}</ThemedText>
              </View>

              <View style={[
                styles.ticketStatusBadge,
                d.status === 'Solved' ? { backgroundColor: 'rgba(16,185,129,0.1)' } : { backgroundColor: 'rgba(239,68,68,0.1)' }
              ]}>
                <ThemedText style={[
                  styles.ticketStatusText,
                  d.status === 'Solved' ? { color: '#10b981' } : { color: '#ef4444' }
                ]}>
                  {d.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={[styles.doubtQuestionContentText, { color: textColor }]}>Q: {d.question}</ThemedText>

            {d.answer ? (
              <View style={[styles.resolutionBox, { backgroundColor: isDarkMode ? '#0d131f' : '#f3f4f6' }]}>
                <ThemedText style={[styles.resolutionTitle, { color: '#10b981' }]}>SOLVED BY FACULTY TUTOR:</ThemedText>
                <ThemedText style={[styles.resolutionBody, { color: textMuted }]}>{d.answer}</ThemedText>
              </View>
            ) : (
              <View style={[styles.resolutionBox, { backgroundColor: 'rgba(239,68,68,0.05)' }]}>
                <ThemedText style={[styles.resolutionTitle, { color: '#ef4444' }]}>SYSTEM UPDATE:</ThemedText>
                <ThemedText style={[styles.resolutionBody, { color: textMuted }]}>
                  Your question has been assigned to a tutor. A complete solution explanation will be published here within 24 hours.
                </ThemedText>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderPlannerView = () => {
    const completedCount = plannerTasks.filter(t => t.completed).length;
    const totalCount = plannerTasks.length;
    const pctVal = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>STUDY PLANNER</ThemedText>
          <ThemedText style={styles.sectionSub}>Organize daily homework checklists and learning deadlines</ThemedText>
        </View>

        <View style={[styles.plannerSummaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.plannerSummaryHeader}>
            <View>
              <ThemedText style={styles.plannerSummaryTitle}>DAILY COMPLETION PROGRESS</ThemedText>
              <ThemedText style={styles.plannerSummarySub}>{completedCount} of {totalCount} tasks completed</ThemedText>
            </View>
            <ThemedText style={styles.plannerSummaryPct}>{pctVal}%</ThemedText>
          </View>
          
          <View style={styles.plannerProgressBarWrapper}>
            <View style={[styles.plannerProgressBarFill, { width: `${pctVal}%`, backgroundColor: '#ff7e40' }]} />
          </View>
        </View>

        <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ThemedText style={styles.cardInputLabel}>ADD NEW STUDY PLAN TASK</ThemedText>
          
          <TextInput
            style={[styles.singleLineInput, { color: textColor, borderColor: cardBorder }]}
            placeholder="What study task are you planning to complete today?"
            placeholderTextColor={textMuted}
            value={newTaskText}
            onChangeText={setNewTaskText}
          />

          <ThemedText style={styles.inputFieldLabel}>TASK PRIORITY</ThemedText>
          <View style={styles.prioritySelectorRow}>
            {['High', 'Medium', 'Low'].map((prio) => {
              const isSel = newTaskPriority === prio;
              return (
                <Pressable
                  key={prio}
                  onPress={() => setNewTaskPriority(prio)}
                  style={[
                    styles.priorityBtn,
                    isSel && styles.priorityBtnActive,
                    { borderColor: cardBorder }
                  ]}
                >
                  <ThemedText style={[styles.priorityText, isSel && styles.priorityTextActive]}>
                    {prio}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.postBtn} onPress={addPlannerTask}>
            <Ionicons name="add-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <ThemedText style={styles.postBtnText}>ADD TO PLANNER</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.subheadingTitle}>PLANNER CHECKLIST</ThemedText>
        {plannerTasks.length === 0 ? (
          <View style={[styles.emptyStateCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="checkbox-outline" size={32} color={textMuted} />
            <ThemedText style={[styles.emptyStateText, { color: textMuted }]}>Your study planner is empty. Create some tasks above!</ThemedText>
          </View>
        ) : (
          plannerTasks.map((t) => (
            <View key={t.id} style={[
              styles.plannerTaskItemCard, 
              { backgroundColor: cardBg, borderColor: cardBorder },
              t.completed && { opacity: 0.7 }
            ]}>
              <View style={styles.plannerTaskLeft}>
                <Pressable 
                  onPress={() => togglePlannerTask(t.id)} 
                  style={[
                    styles.taskCheckbox,
                    { borderColor: cardBorder },
                    t.completed && { backgroundColor: '#ff7e40', borderColor: '#ff7e40' }
                  ]}
                >
                  {t.completed && <Ionicons name="checkmark" size={10} color="#ffffff" />}
                </Pressable>
                
                <View style={{ flex: 1 }}>
                  <ThemedText style={[
                    styles.taskItemText, 
                    { color: textColor },
                    t.completed && styles.taskItemTextCompleted
                  ]}>
                    {t.text}
                  </ThemedText>
                  
                  <View style={[
                    styles.prioTagBadge,
                    t.priority === 'High' && { backgroundColor: 'rgba(239,68,68,0.1)' },
                    t.priority === 'Medium' && { backgroundColor: 'rgba(255,126,64,0.1)' },
                    t.priority === 'Low' && { backgroundColor: 'rgba(59,130,246,0.1)' }
                  ]}>
                    <ThemedText style={[
                      styles.prioTagText,
                      t.priority === 'High' && { color: '#ef4444' },
                      t.priority === 'Medium' && { color: '#ff7e40' },
                      t.priority === 'Low' && { color: '#3b82f6' }
                    ]}>
                      {t.priority.toUpperCase()} PRIORITY
                    </ThemedText>
                  </View>
                </View>
              </View>

              <Pressable onPress={() => deletePlannerTask(t.id)} style={styles.taskDeleteBtn}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderNoticeBoardView = () => {
    const filteredNotices = notices.filter(n => 
      n.title.toLowerCase().includes(noticeSearch.toLowerCase()) ||
      n.body.toLowerCase().includes(noticeSearch.toLowerCase()) ||
      n.category.toLowerCase().includes(noticeSearch.toLowerCase())
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>NOTICE BOARD</ThemedText>
          <ThemedText style={styles.sectionSub}>Review official postings and circular notices</ThemedText>
        </View>

        <View style={[styles.searchBoxWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="search" size={16} color={textMuted} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search circular announcements..."
            placeholderTextColor={textMuted}
            value={noticeSearch}
            onChangeText={setNoticeSearch}
          />
        </View>

        {filteredNotices.map((n) => (
          <View key={n.id} style={[styles.noticeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.noticeCardHeader}>
              <View style={styles.noticeTitleCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {n.pinned && <Ionicons name="pin" size={12} color="#ff7e40" />}
                  <ThemedText style={[styles.noticeTitleText, { color: textColor }]}>{n.title}</ThemedText>
                </View>
                <ThemedText style={styles.noticeDateText}>{n.date} • {n.category.toUpperCase()}</ThemedText>
              </View>
              
              <View style={[
                styles.noticeCategoryBadge,
                { backgroundColor: 'rgba(255, 126, 64, 0.1)', borderColor: 'rgba(255,126,64,0.2)' }
              ]}>
                <ThemedText style={styles.noticeCategoryText}>{n.category}</ThemedText>
              </View>
            </View>
            
            <View style={[styles.classCardDivider, { backgroundColor: cardBorder }]} />
            
            <ThemedText style={[styles.noticeBodyText, { color: textMuted }]}>{n.body}</ThemedText>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderActiveViewContent = () => {
    switch (activeView) {
      case 'dashboard':
        return renderDashboardView();
      case 'nexus':
        return renderNexusView();
      case 'profile':
        return renderProfileView();
      case 'classes':
        return renderClassesView();
      case 'attendance':
        return renderAttendanceView();
      case 'exams':
        return renderExamsView();
      case 'results':
        return renderResultsView();
      case 'video_content':
        return renderVideoContentView();
      case 'notes':
        return renderNotesView();
      case 'dpp_questions':
        return renderDppQuestionsView();
      case 'performance':
        return renderPerformanceView();
      case 'analytics':
        return renderAnalyticsView();
      case 'grievances':
        return renderGrievancesView();
      case 'doubts':
        return renderDoubtsView();
      case 'planner':
        return renderPlannerView();
      case 'notice_board':
        return renderNoticeBoardView();
      default:
        return renderDashboardView();
    }
  };

  const SidebarContent = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
      { id: 'nexus', label: 'Nexus Hub', icon: 'compass-outline' },
      { id: 'profile', label: 'My Profile', icon: 'person-outline' },
      { id: 'classes', label: 'Classes', icon: 'calendar-outline' },
      { id: 'attendance', label: 'Attendance', icon: 'checkbox-outline' },
      { id: 'exams', label: 'Exams', icon: 'document-text-outline' },
      { id: 'results', label: 'Results', icon: 'trophy-outline' },
      { 
        id: 'study_materials', 
        label: 'Study Materials', 
        icon: 'book-outline',
        isDropdown: true,
        children: [
          { id: 'video_content', label: 'Video Content' },
          { id: 'notes', label: 'Notes' },
          { id: 'dpp_questions', label: 'DPP Questions' }
        ]
      },
      { id: 'performance', label: 'Performance', icon: 'trending-up-outline' },
      { id: 'analytics', label: 'Advanced Analytics', icon: 'bar-chart-outline' },
      { id: 'grievances', label: 'Grievances', icon: 'alert-circle-outline' },
      { id: 'doubts', label: 'Doubts', icon: 'help-circle-outline' },
      { id: 'planner', label: 'Study Planner', icon: 'calendar-outline' },
      { id: 'notice_board', label: 'Notice Board', icon: 'notifications-outline' }
    ];

    const isChildActive = (item) => {
      if (!item.isDropdown) return false;
      return item.children.some(child => child.id === activeView);
    };

    return (
      <View style={styles.sidebarWrapper}>
        <View style={styles.sidebarLogoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="sunny" size={18} color="#ffffff" />
          </View>
          <View>
            <ThemedText style={styles.sidebarLogoText}>Pathfinder</ThemedText>
            <ThemedText style={styles.sidebarLogoSubText}>STUDENT HUB</ThemedText>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.sidebarScroll}
        >
          {menuItems.map((item) => {
            const isSelected = activeView === item.id || isChildActive(item);
            
            if (item.isDropdown) {
              const isOpen = studyMaterialsExpanded;
              return (
                <View key={item.id} style={styles.dropdownContainer}>
                  <Pressable
                    onPress={() => setStudyMaterialsExpanded(!isOpen)}
                    style={[
                      styles.sidebarItem,
                      isSelected && styles.sidebarItemActive
                    ]}
                  >
                    <View style={styles.sidebarItemLeft}>
                      <Ionicons 
                        name={item.icon} 
                        size={18} 
                        color={isSelected ? '#38bdf8' : '#8b9bb4'} 
                      />
                      <ThemedText style={[
                        styles.sidebarItemText,
                        isSelected && styles.sidebarItemTextActive
                      ]}>
                        {item.label}
                      </ThemedText>
                    </View>
                    <Ionicons 
                      name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'} 
                      size={14} 
                      color={isSelected ? '#38bdf8' : '#8b9bb4'} 
                    />
                    
                    {isSelected && (
                      <View style={styles.activeDotIndicator} />
                    )}
                  </Pressable>

                  {isOpen && (
                    <View style={styles.submenuWrapper}>
                      <View style={styles.submenuTreeLine} />
                      
                      <View style={styles.submenuItems}>
                        {item.children.map((child) => {
                          const isChildSelected = activeView === child.id;
                          return (
                            <Pressable
                              key={child.id}
                              onPress={() => handleSidebarItemClick(child.id)}
                              style={[
                                styles.submenuItem,
                                isChildSelected && styles.submenuItemActive
                              ]}
                            >
                              <ThemedText style={[
                                styles.submenuItemText,
                                isChildSelected && styles.submenuItemTextActive
                              ]}>
                                {child.label}
                              </ThemedText>
                              {isChildSelected && (
                                <View style={styles.activeDotIndicatorSmall} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            }

            return (
              <Pressable
                key={item.id}
                onPress={() => handleSidebarItemClick(item.id)}
                style={[
                  styles.sidebarItem,
                  isSelected && styles.sidebarItemActive
                ]}
              >
                <View style={styles.sidebarItemLeft}>
                  <Ionicons 
                    name={item.icon} 
                    size={18} 
                    color={isSelected ? '#38bdf8' : '#8b9bb4'} 
                  />
                  <ThemedText style={[
                    styles.sidebarItemText,
                    isSelected && styles.sidebarItemTextActive
                  ]}>
                    {item.label}
                  </ThemedText>
                </View>

                {isSelected && (
                  <View style={styles.activeDotIndicator} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: customBg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <View style={styles.shell}>
        {isLargeScreen ? (
          <View style={[styles.sidebar, { backgroundColor: '#070a13', borderRightColor: cardBorder }]}>
            <SidebarContent />
          </View>
        ) : (
          <>
            {sidebarOpen && (
              <Pressable style={styles.drawerBackdrop} onPress={toggleSidebar}>
                <View style={styles.backdropBg} />
              </Pressable>
            )}
            <Animated.View style={[styles.mobileDrawer, { transform: [{ translateX: drawerAnim }], backgroundColor: '#070a13' }]}>
              <SidebarContent />
            </Animated.View>
          </>
        )}

        <View style={styles.mainArea}>
          <View style={[styles.header, { borderBottomColor: cardBorder, paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.headerLeft}>
              {!isLargeScreen && (
                <Pressable onPress={toggleSidebar} style={styles.hamburgerBtn}>
                  <Ionicons name="menu-outline" size={24} color={textColor} />
                </Pressable>
              )}
              
              <View style={styles.logoSquare}>
                <Ionicons name="school" size={16} color="#ffffff" />
              </View>
              <ThemedText style={[styles.headerTitle, { color: textColor }]}>
                {activeView === 'dashboard' ? 'STUDY PORTAL' : activeView.toUpperCase().replace('_', ' ')}
              </ThemedText>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                onPress={toggleTheme}
                style={[styles.headerBtn, { backgroundColor: isDarkMode ? '#101726' : '#ffffff', borderColor: cardBorder }]}
              >
                <FontAwesome name={isDarkMode ? 'sun-o' : 'moon-o'} size={14} color={isDarkMode ? '#ff7e40' : '#4a2d1b'} />
              </Pressable>
              
              <Pressable
                onPress={handleLogout}
                style={[styles.headerBtn, styles.logoutBtn]}
              >
                <Ionicons name="log-out-outline" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.viewContentWrapper}>
            {renderActiveViewContent()}
          </View>

          {activeView === 'dashboard' && (
            <View style={[styles.stickyFooter, { borderTopColor: cardBorder, backgroundColor: isDarkMode ? '#0d131f' : '#ffffff' }]}>
              <View style={styles.footerInfo}>
                <View style={styles.alertIconBg}>
                  <Ionicons name="alert" size={14} color="#ff7e40" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.footerAlertTitle, { color: textColor }]}>STUDY PLANNER COUNTDOWN</ThemedText>
                  <ThemedText style={styles.footerAlertSub}>Upcoming deadline for assignments</ThemedText>
                </View>
              </View>
              <Pressable style={styles.footerActionBtn} onPress={() => setActiveView('planner')}>
                <ThemedText style={styles.footerActionBtnText}>GO TO PLANNER</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    borderColor: 'transparent',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 20,
  },
  heroSection: {
    gap: 16,
  },
  heroLeft: {
    gap: 6,
  },
  hubLabel: {
    color: '#ff7e40',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  orangeText: {
    color: '#ff7e40',
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  insightsLink: {
    color: '#ff7e40',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshBtnText: {
    color: '#ff7e40',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#101726',
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '900',
  },
  enrollmentLabel: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '700',
  },
  enrollmentVal: {
    color: '#ff7e40',
  },
  classBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 126, 64, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  classBadgeText: {
    color: '#ff7e40',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardStatusMuted: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  progressBarWrapper: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  greenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greenBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  grayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  grayBadgeText: {
    color: '#8b9bb4',
    fontSize: 9,
    fontWeight: '900',
  },
  examTitle: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  examSpecs: {
    fontSize: 9,
    color: '#ff7e40',
    fontWeight: '700',
  },
  ongoingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 126, 64, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ongoingBadgeText: {
    color: '#ff7e40',
    fontSize: 9,
    fontWeight: '900',
  },
  streakSub: {
    fontSize: 9,
    color: '#ec4899',
    fontWeight: '600',
  },
  streakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakBadgeText: {
    color: '#ec4899',
    fontSize: 9,
    fontWeight: '900',
  },
  analyticsSection: {
    gap: 12,
  },
  analyticsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  analyticsContent: {
    gap: 6,
    zIndex: 10,
  },
  analyticsLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1.5,
  },
  strongValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  focusValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  analyticsDesc: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  analysisBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  analysisBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  focusStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  focusStatusText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '900',
  },
  watermarkIcon: {
    position: 'absolute',
    right: 16,
    bottom: -8,
  },
  chartContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  chartHeader: {
    gap: 4,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chartSub: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '900',
  },
  chartBox: {
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  chartPlaceholderText: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '900',
    letterSpacing: 1,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  chartLabelText: {
    fontSize: 8,
    color: '#8b9bb4',
    fontWeight: '950',
    letterSpacing: 0.5,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  footerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 126, 64, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerAlertTitle: {
    fontSize: 9,
    fontWeight: '900',
  },
  footerAlertSub: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
    marginTop: 1,
  },
  footerActionBtn: {
    backgroundColor: '#ff7e40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerActionBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // --- NEW STYLE DEFINITIONS ---
  shell: {
    flexDirection: 'row',
    flex: 1,
    height: '100%',
  },
  sidebar: {
    width: 260,
    height: '100%',
    borderRightWidth: 1,
  },
  mobileDrawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 260,
    zIndex: 100,
    height: '100%',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  backdropBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mainArea: {
    flex: 1,
    height: '100%',
  },
  viewContentWrapper: {
    flex: 1,
  },
  hamburgerBtn: {
    padding: 6,
    marginRight: 4,
  },
  sidebarWrapper: {
    flex: 1,
    paddingTop: 30,
    paddingBottom: 20,
  },
  sidebarLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLogoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  sidebarLogoSubText: {
    color: '#3b82f6',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sidebarScroll: {
    paddingHorizontal: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    position: 'relative',
    marginBottom: 4,
  },
  sidebarItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sidebarItemText: {
    color: '#8b9bb4',
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarItemTextActive: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  activeDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#818cf8',
    position: 'absolute',
    right: 12,
  },
  dropdownContainer: {
    width: '100%',
  },
  submenuWrapper: {
    flexDirection: 'row',
    paddingLeft: 22,
    marginTop: 2,
    marginBottom: 8,
  },
  submenuTreeLine: {
    width: 1.5,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    marginRight: 10,
  },
  submenuItems: {
    flex: 1,
    gap: 4,
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  submenuItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  submenuItemText: {
    color: '#8b9bb4',
    fontSize: 11,
    fontWeight: '700',
  },
  submenuItemTextActive: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  activeDotIndicatorSmall: {
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#38bdf8',
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ff7e40',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  inputCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  cardInputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff7e40',
    letterSpacing: 1,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    height: 75,
    textAlignVertical: 'top',
    fontWeight: '600',
  },
  singleLineInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff7e40',
    borderRadius: 10,
    paddingVertical: 10,
  },
  postBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallLetter: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  feedAuthorInfo: {
    flex: 1,
  },
  feedAuthorName: {
    fontSize: 13,
    fontWeight: '900',
  },
  feedAuthorRole: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '700',
  },
  feedContentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  feedActionRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 20,
  },
  feedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  commentItem: {
    flexDirection: 'row',
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#ff7e40',
    paddingVertical: 2,
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 11,
    fontWeight: '800',
  },
  commentContent: {
    fontSize: 11,
    fontWeight: '600',
  },
  addCommentRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  commentTextInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  commentSendBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subheadingTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 8,
  },
  profileViewHeaderCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  largeAvatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#ff7e40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarLetter: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  largeProfileName: {
    fontSize: 18,
    fontWeight: '900',
  },
  largeEnrollment: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '700',
  },
  largeClassBadge: {
    backgroundColor: 'rgba(255,126,64,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  largeClassBadgeText: {
    color: '#ff7e40',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 16,
  },
  profileEditBtnText: {
    color: '#ff7e40',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileEditInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    width: 160,
    textAlign: 'right',
    fontWeight: '600',
  },
  detailGroupCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  detailGroupHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff7e40',
    letterSpacing: 1,
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  detailItemLabel: {
    fontSize: 12,
    color: '#8b9bb4',
    fontWeight: '700',
  },
  detailItemValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  daySelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  daySelectorBtn: {
    flex: 1,
    minWidth: 46,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelectorBtnActive: {
    backgroundColor: '#ff7e40',
    borderColor: '#ff7e40',
  },
  daySelectorText: {
    color: '#8b9bb4',
    fontSize: 12,
    fontWeight: '800',
  },
  daySelectorTextActive: {
    color: '#ffffff',
  },
  emptyStateCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyStateText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  classLectureCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  classCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classSubjectWrapper: {
    gap: 2,
  },
  classSubjectText: {
    fontSize: 15,
    fontWeight: '900',
  },
  classTeacherText: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  classStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  classStatusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusCompletedBg: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  statusCompletedText: {
    color: '#10b981',
  },
  statusOngoingBg: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  statusOngoingText: {
    color: '#3b82f6',
  },
  statusUpcomingBg: {
    backgroundColor: 'rgba(255,126,64,0.1)',
  },
  statusUpcomingText: {
    color: '#ff7e40',
  },
  classCardDivider: {
    height: 1,
  },
  classCardBottom: {
    flexDirection: 'row',
    gap: 20,
  },
  classDetailCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classDetailText: {
    fontSize: 11,
    fontWeight: '600',
  },
  joinClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 4,
  },
  joinClassBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  attendanceRegistryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  attendanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attendanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attendanceDateText: {
    fontSize: 13,
    fontWeight: '900',
  },
  attendanceDetailsText: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  attendanceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attendanceStatusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  examCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  examCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  examCardTitleCol: {
    gap: 2,
  },
  examCardName: {
    fontSize: 14,
    fontWeight: '900',
  },
  examCardDateText: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  examSpecsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingVertical: 10,
  },
  examSpecItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  examSpecLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#8b9bb4',
  },
  examSpecVal: {
    fontSize: 11,
    fontWeight: '900',
  },
  examActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  examActionBtnText: {
    color: '#ff7e40',
    fontSize: 10,
    fontWeight: '900',
  },
  resultsGPAHeaderCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  gpaHeaderLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1,
  },
  gpaHeaderValue: {
    fontSize: 26,
    fontWeight: '950',
  },
  gpaBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gpaSubBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gpaSubBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  resultSubjectCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  resultSubjectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultSubjectTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  resultMarksLabel: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  resultGradeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 126, 64, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultGradeText: {
    color: '#ff7e40',
    fontSize: 12,
    fontWeight: '900',
  },
  resultSubjectProgressWrapper: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  resultSubjectProgressBar: {
    height: '100%',
  },
  resultSubjectBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultPercentageText: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '700',
  },
  resultStatusText: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '900',
  },
  videoPlayerCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  videoMockScreen: {
    height: 140,
    borderRadius: 12,
    backgroundColor: '#0c0e17',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlayerTimeText: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '800',
  },
  videoPlayerControls: {
    gap: 4,
  },
  videoPlayingTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  videoPlayingTeacher: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  videoPlayerSeekBarWrapper: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1.5,
    marginTop: 4,
  },
  videoPlayerSeekBar: {
    height: '100%',
    backgroundColor: '#ff7e40',
  },
  videoPlayerBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  videoClosePlayerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 126, 64, 0.15)',
  },
  videoClosePlayerText: {
    color: '#ff7e40',
    fontSize: 10,
    fontWeight: '900',
  },
  searchBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    height: '100%',
    fontWeight: '600',
  },
  videoLectureCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  videoLectureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  videoIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,126,64,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTextCol: {
    flex: 1,
    gap: 2,
  },
  videoTitleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  videoTeacherText: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  videoBadgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subjectBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectBadgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
  },
  videoViewsText: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  notesCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  notesCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pdfIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesTextCol: {
    flex: 1,
    gap: 2,
  },
  notesTitleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  notesSpecsText: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  notesDownloadBtn: {
    padding: 4,
  },
  quizQuestionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  quizQuestionText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  quizOptionsList: {
    gap: 8,
  },
  quizOptionBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  quizOptionText: {
    color: '#8b9bb4',
    fontSize: 12,
    fontWeight: '600',
  },
  quizOptionSelected: {
    backgroundColor: 'rgba(255, 126, 64, 0.1)',
    borderColor: '#ff7e40',
  },
  quizOptionSelectedText: {
    color: '#ff7e40',
    fontWeight: '900',
  },
  quizOptionCorrect: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: '#10b981',
  },
  quizOptionCorrectText: {
    color: '#10b981',
    fontWeight: '900',
  },
  quizOptionWrong: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: '#ef4444',
  },
  quizOptionWrongText: {
    color: '#ef4444',
    fontWeight: '900',
  },
  quizResultsSummaryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  quizSummaryTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1,
  },
  quizScoreVal: {
    fontSize: 28,
    fontWeight: '950',
    marginBottom: 4,
  },
  quizStatusDesc: {
    fontSize: 12,
    color: '#8b9bb4',
    fontWeight: '700',
    textAlign: 'center',
  },
  quizResetBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  quizResetBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  quizSubmitBtn: {
    backgroundColor: '#ff7e40',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  quizSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dppCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  dppCodeIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,126,64,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dppTextCol: {
    flex: 1,
    gap: 2,
    marginLeft: 10,
  },
  dppTitleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  dppSpecsText: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  dppActionCol: {
    // Spacer or layout
  },
  dppScoreBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dppScoreText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
  },
  dppAttemptBtn: {
    backgroundColor: '#ff7e40',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dppAttemptBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  metricHighlightCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 1,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '950',
  },
  metricChangeGreen: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '800',
  },
  performanceMockChartContainer: {
    flexDirection: 'row',
    height: 140,
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 10,
  },
  chartBarCol: {
    alignItems: 'center',
    width: 40,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBarSolid: {
    width: 14,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '800',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  matrixSubject: {
    width: 90,
    fontSize: 12,
    fontWeight: '800',
  },
  matrixBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  matrixBarFill: {
    height: '100%',
  },
  matrixPct: {
    width: 30,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  analyticsFeatureCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  analyticsFeatureTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  analyticsFeatureBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  recommendationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,126,64,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendationText: {
    color: '#ff7e40',
    fontSize: 9,
    fontWeight: '900',
  },
  focusTopicItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  focusTopicTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  focusTopicDesc: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  categoryBadgeScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
    marginBottom: 8,
  },
  catBadgeItem: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  catBadgeItemActive: {
    backgroundColor: '#ff7e40',
    borderColor: '#ff7e40',
  },
  catBadgeText: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '800',
  },
  catBadgeTextActive: {
    color: '#ffffff',
  },
  inputFieldLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8b9bb4',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  ticketCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  ticketCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketSubject: {
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
    marginRight: 10,
  },
  ticketMetaText: {
    fontSize: 9,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  ticketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ticketStatusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  ticketDescriptionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  resolutionBox: {
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  resolutionTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resolutionBody: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  doubtQuestionContentText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  plannerSummaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  plannerSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plannerSummaryTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff7e40',
    letterSpacing: 1,
  },
  plannerSummarySub: {
    fontSize: 11,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  plannerSummaryPct: {
    fontSize: 24,
    fontWeight: '950',
    color: '#ff7e40',
  },
  plannerProgressBarWrapper: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  plannerProgressBarFill: {
    height: '100%',
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  priorityBtnActive: {
    backgroundColor: '#ff7e40',
    borderColor: '#ff7e40',
  },
  priorityText: {
    color: '#8b9bb4',
    fontSize: 11,
    fontWeight: '900',
  },
  priorityTextActive: {
    color: '#ffffff',
  },
  plannerTaskItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  plannerTaskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskItemText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskItemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#8b9bb4',
  },
  prioTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  prioTagText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  taskDeleteBtn: {
    padding: 6,
  },
  noticeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  noticeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeTitleCol: {
    gap: 2,
    flex: 1,
    marginRight: 10,
  },
  noticeTitleText: {
    fontSize: 13,
    fontWeight: '900',
  },
  noticeDateText: {
    fontSize: 10,
    color: '#8b9bb4',
    fontWeight: '600',
  },
  noticeCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  noticeCategoryText: {
    color: '#ff7e40',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  noticeBodyText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});

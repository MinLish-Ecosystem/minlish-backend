/**
 * ─── Seed Script v2 — Safe Upsert ────────────────────────────────────────────
 * - XÓA: 2 set IELTS cũ (không có từ nào)
 * - GIỮ: Tất cả users hiện có
 * - THÊM MỚI: UserProfiles, 5 VocabSets, ~52 Words, LearningProgress, DailyStats, Notifications
 *
 * Chạy: npx ts-node --transpile-only src/scripts/seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();
try { dns.setServers(['1.1.1.1', '8.8.8.8']); } catch (_) {}

import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { VocabularySet } from '../models/VocabularySet';
import { Word } from '../models/Word';
import { LearningProgress } from '../models/LearningProgress';
import { DailyStats } from '../models/DailyStats';
import { Notification } from '../models/Nofitication';

// ─── Audio URL helper (Google TTS — không cần key) ────────────────────────────
const tts = (word: string) =>
  `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;

// ─── Image URL helper (picsum — nhất quán theo tên từ) ───────────────────────
const img = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/300`;

// ─── Định nghĩa 5 bộ từ vựng ─────────────────────────────────────────────────
const SETS_DATA = [
  {
    name: 'IELTS Academic Core',
    description: 'Bộ từ vựng học thuật quan trọng nhất trong IELTS — thường xuất hiện trong reading và writing task 2.',
    category: 'IELTS',
    level: 'Advanced',
    colorTheme: 'purple',
    tags: ['ielts', 'academic', 'writing', 'reading'],
    isPublic: true,
    words: [
      {
        word: 'abandon',
        pronunciation: '/əˈbændən/',
        partOfSpeech: 'verb',
        meaning: 'từ bỏ, bỏ rơi',
        descriptionEN: 'To stop doing something or leave a place or situation permanently.',
        examples: [
          'Scientists abandoned the experiment due to lack of funding.',
          'The government was forced to abandon its economic policy.',
        ],
        synonyms: ['forsake', 'desert', 'relinquish', 'give up'],
        antonyms: ['maintain', 'continue', 'keep'],
        collocations: ['abandon hope', 'abandon ship', 'abandon a project'],
      },
      {
        word: 'abstract',
        pronunciation: '/ˈæbstrækt/',
        partOfSpeech: 'adjective',
        meaning: 'trừu tượng; bản tóm tắt',
        descriptionEN: 'Existing in thought or as an idea but not having a physical or concrete existence.',
        examples: [
          'Justice is an abstract concept that varies across cultures.',
          'The researchers wrote a clear abstract summarizing their findings.',
        ],
        synonyms: ['theoretical', 'conceptual', 'intangible'],
        antonyms: ['concrete', 'tangible', 'physical'],
        collocations: ['abstract idea', 'abstract thinking', 'abstract noun'],
      },
      {
        word: 'acknowledge',
        pronunciation: '/əkˈnɒlɪdʒ/',
        partOfSpeech: 'verb',
        meaning: 'thừa nhận, công nhận',
        descriptionEN: 'To accept or admit the existence or truth of something.',
        examples: [
          'The report acknowledges that there are significant challenges ahead.',
          'She acknowledged her mistake and apologized.',
        ],
        synonyms: ['admit', 'recognize', 'concede', 'accept'],
        antonyms: ['deny', 'reject', 'ignore'],
        collocations: ['acknowledge a problem', 'acknowledge receipt', 'acknowledge the fact'],
      },
      {
        word: 'aggregate',
        pronunciation: '/ˈæɡrɪɡət/',
        partOfSpeech: 'noun',
        meaning: 'tổng hợp, tổng cộng',
        descriptionEN: 'A whole formed by combining several separate elements.',
        examples: [
          'The aggregate of evidence suggests climate change is accelerating.',
          'In aggregate, these small improvements led to significant cost savings.',
        ],
        synonyms: ['total', 'sum', 'combined', 'collective'],
        antonyms: ['individual', 'separate', 'partial'],
        collocations: ['in the aggregate', 'aggregate data', 'aggregate demand'],
      },
      {
        word: 'ambiguous',
        pronunciation: '/æmˈbɪɡjuəs/',
        partOfSpeech: 'adjective',
        meaning: 'mơ hồ, không rõ ràng',
        descriptionEN: 'Open to more than one interpretation; not having one obvious meaning.',
        examples: [
          'The contract contained several ambiguous clauses.',
          'Her response was deliberately ambiguous to avoid commitment.',
        ],
        synonyms: ['unclear', 'vague', 'equivocal', 'uncertain'],
        antonyms: ['clear', 'definite', 'unambiguous', 'explicit'],
        collocations: ['ambiguous language', 'ambiguous situation', 'morally ambiguous'],
      },
      {
        word: 'assess',
        pronunciation: '/əˈsɛs/',
        partOfSpeech: 'verb',
        meaning: 'đánh giá, nhận định',
        descriptionEN: 'To evaluate or estimate the nature, ability, or quality of something.',
        examples: [
          'Teachers assess students through both exams and coursework.',
          'The committee met to assess the impact of the new regulation.',
        ],
        synonyms: ['evaluate', 'appraise', 'judge', 'gauge'],
        antonyms: [],
        collocations: ['assess the situation', 'assess risk', 'assess performance'],
      },
      {
        word: 'assume',
        pronunciation: '/əˈsjuːm/',
        partOfSpeech: 'verb',
        meaning: 'giả định, cho rằng',
        descriptionEN: 'To suppose something to be the case, without proof.',
        examples: [
          'We cannot assume that all readers have prior knowledge of the topic.',
          'The study assumes a linear relationship between the variables.',
        ],
        synonyms: ['presume', 'suppose', 'take for granted', 'hypothesize'],
        antonyms: ['prove', 'verify', 'confirm'],
        collocations: ['assume responsibility', 'it is assumed that', 'assume control'],
      },
      {
        word: 'coherent',
        pronunciation: '/kəʊˈhɪərənt/',
        partOfSpeech: 'adjective',
        meaning: 'mạch lạc, nhất quán',
        descriptionEN: 'Logical and consistent; (of an argument, theory, or policy) able to be understood.',
        examples: [
          'A good essay should present a coherent argument throughout.',
          'The government needs a coherent strategy to address unemployment.',
        ],
        synonyms: ['logical', 'consistent', 'clear', 'articulate'],
        antonyms: ['incoherent', 'disjointed', 'confused'],
        collocations: ['coherent argument', 'coherent policy', 'coherent explanation'],
      },
      {
        word: 'constitute',
        pronunciation: '/ˈkɒnstɪtjuːt/',
        partOfSpeech: 'verb',
        meaning: 'cấu thành, tạo nên',
        descriptionEN: 'To be a part or member of something; to make up or form something.',
        examples: [
          'Women constitute 40% of the workforce in this sector.',
          'This discovery constitutes a major breakthrough in cancer research.',
        ],
        synonyms: ['comprise', 'make up', 'form', 'compose'],
        antonyms: [],
        collocations: ['constitute a majority', 'constitute a threat', 'constitute evidence'],
      },
      {
        word: 'derive',
        pronunciation: '/dɪˈraɪv/',
        partOfSpeech: 'verb',
        meaning: 'bắt nguồn từ, thu được',
        descriptionEN: 'To obtain something from a specified source; to originate from.',
        examples: [
          'English derives many words from Latin and French.',
          'The company derives most of its revenue from software subscriptions.',
        ],
        synonyms: ['obtain', 'extract', 'draw', 'stem from'],
        antonyms: [],
        collocations: ['derive benefit', 'derive satisfaction', 'derive from a source'],
      },
    ],
  },
  {
    name: 'Phrasal Verbs Essential',
    description: 'Top 10 phrasal verbs người học tiếng Anh phải nắm — xuất hiện hàng ngày trong giao tiếp tự nhiên.',
    category: 'General',
    level: 'Intermediate',
    colorTheme: 'emerald',
    tags: ['phrasal verb', 'speaking', 'conversation', 'daily'],
    isPublic: true,
    words: [
      {
        word: 'break down',
        pronunciation: '/breɪk daʊn/',
        partOfSpeech: 'phrase',
        meaning: 'hỏng hóc; bị suy sụp; phân tích chi tiết',
        descriptionEN: 'To stop working; to lose control emotionally; to analyse something in detail.',
        examples: [
          'The car broke down on the motorway during rush hour.',
          'She broke down in tears when she heard the news.',
          'Let me break down the costs for you.',
        ],
        synonyms: ['malfunction', 'collapse', 'analyse'],
        antonyms: ['function', 'work'],
        collocations: ['break down barriers', 'break down the problem'],
      },
      {
        word: 'bring up',
        pronunciation: '/brɪŋ ʌp/',
        partOfSpeech: 'phrase',
        meaning: 'nhắc đến; nuôi dưỡng (con cái)',
        descriptionEN: 'To mention a subject; to raise or care for a child.',
        examples: [
          'Could you bring up this issue at the next meeting?',
          'She was brought up in a small town in the countryside.',
        ],
        synonyms: ['mention', 'raise', 'introduce'],
        antonyms: ['drop', 'avoid'],
        collocations: ['bring up a topic', 'bring up children'],
      },
      {
        word: 'carry out',
        pronunciation: '/ˈkæri aʊt/',
        partOfSpeech: 'phrase',
        meaning: 'thực hiện, tiến hành',
        descriptionEN: 'To do or complete a task, plan, or activity.',
        examples: [
          'The scientists carried out extensive research before publishing.',
          'The surgery was carried out successfully.',
        ],
        synonyms: ['perform', 'execute', 'conduct', 'implement'],
        antonyms: ['abandon', 'neglect'],
        collocations: ['carry out research', 'carry out instructions', 'carry out a plan'],
      },
      {
        word: 'come across',
        pronunciation: '/kʌm əˈkrɒs/',
        partOfSpeech: 'phrase',
        meaning: 'tình cờ gặp; tạo ấn tượng',
        descriptionEN: 'To find or meet by chance; to give a particular impression.',
        examples: [
          'I came across this interesting article while reading the newspaper.',
          'He comes across as very confident in interviews.',
        ],
        synonyms: ['encounter', 'stumble upon', 'find'],
        antonyms: [],
        collocations: ['come across as', 'come across information'],
      },
      {
        word: 'figure out',
        pronunciation: '/ˈfɪɡər aʊt/',
        partOfSpeech: 'phrase',
        meaning: 'tìm ra, giải quyết, hiểu được',
        descriptionEN: 'To understand or solve something after thinking carefully about it.',
        examples: [
          'I need some time to figure out the solution to this problem.',
          'Can you figure out how this machine works?',
        ],
        synonyms: ['understand', 'solve', 'work out', 'determine'],
        antonyms: [],
        collocations: ['figure out a solution', 'figure out the answer'],
      },
      {
        word: 'give up',
        pronunciation: '/ɡɪv ʌp/',
        partOfSpeech: 'phrase',
        meaning: 'từ bỏ, bỏ cuộc',
        descriptionEN: 'To stop trying to do something; to stop doing something as a habit.',
        examples: [
          'Don\'t give up — you\'re almost there!',
          'He gave up smoking after his doctor\'s advice.',
        ],
        synonyms: ['quit', 'abandon', 'surrender', 'stop'],
        antonyms: ['persist', 'continue', 'persevere'],
        collocations: ['give up hope', 'give up a habit', 'refuse to give up'],
      },
      {
        word: 'look forward to',
        pronunciation: '/lʊk ˈfɔːwəd tə/',
        partOfSpeech: 'phrase',
        meaning: 'mong chờ, trông đợi',
        descriptionEN: 'To feel excited and happy about something that is going to happen.',
        examples: [
          'I look forward to hearing from you soon.',
          'The children are looking forward to the holidays.',
        ],
        synonyms: ['anticipate', 'await eagerly'],
        antonyms: ['dread'],
        collocations: ['look forward to meeting', 'look forward to the opportunity'],
      },
      {
        word: 'make up',
        pronunciation: '/meɪk ʌp/',
        partOfSpeech: 'phrase',
        meaning: 'bịa đặt; hòa giải; trang điểm',
        descriptionEN: 'To invent a story; to reconcile after a disagreement; to apply cosmetics.',
        examples: [
          'Stop making up excuses for being late.',
          'They argued but made up the next day.',
        ],
        synonyms: ['fabricate', 'invent', 'reconcile'],
        antonyms: [],
        collocations: ['make up a story', 'make up your mind', 'make up for lost time'],
      },
      {
        word: 'point out',
        pronunciation: '/pɔɪnt aʊt/',
        partOfSpeech: 'phrase',
        meaning: 'chỉ ra, lưu ý',
        descriptionEN: 'To tell someone about a piece of information, drawing their attention to it.',
        examples: [
          'She politely pointed out the error in the report.',
          'The guide pointed out the historical significance of the building.',
        ],
        synonyms: ['indicate', 'highlight', 'draw attention to'],
        antonyms: [],
        collocations: ['point out a mistake', 'point out the fact that'],
      },
      {
        word: 'run out of',
        pronunciation: '/rʌn aʊt əv/',
        partOfSpeech: 'phrase',
        meaning: 'hết, cạn kiệt',
        descriptionEN: 'To use all of something so that there is none left.',
        examples: [
          'We ran out of time before finishing the exam.',
          'The hospital is running out of medical supplies.',
        ],
        synonyms: ['exhaust', 'deplete', 'use up'],
        antonyms: ['replenish', 'stockpile'],
        collocations: ['run out of time', 'run out of money', 'run out of ideas'],
      },
    ],
  },
  {
    name: 'Business English Pro',
    description: 'Từ vựng tiếng Anh thương mại dùng trong email, họp hành, và đàm phán chuyên nghiệp.',
    category: 'Business',
    level: 'Advanced',
    colorTheme: 'amber',
    tags: ['business', 'workplace', 'professional', 'email'],
    isPublic: true,
    words: [
      {
        word: 'agenda',
        pronunciation: '/əˈdʒɛndə/',
        partOfSpeech: 'noun',
        meaning: 'chương trình nghị sự, kế hoạch',
        descriptionEN: 'A list of items to be discussed at a meeting; a plan of things to be done.',
        examples: [
          'The meeting agenda includes three key topics for discussion.',
          'What\'s on the agenda for today\'s board meeting?',
        ],
        synonyms: ['schedule', 'plan', 'programme', 'timetable'],
        antonyms: [],
        collocations: ['set the agenda', 'hidden agenda', 'agenda item'],
      },
      {
        word: 'benchmark',
        pronunciation: '/ˈbɛntʃmɑːk/',
        partOfSpeech: 'noun',
        meaning: 'tiêu chuẩn đối chiếu, điểm tham chiếu',
        descriptionEN: 'A standard or point of reference used for comparison or measurement.',
        examples: [
          'Our sales performance exceeded industry benchmarks this quarter.',
          'The company uses customer satisfaction as a key benchmark.',
        ],
        synonyms: ['standard', 'yardstick', 'reference point', 'measure'],
        antonyms: [],
        collocations: ['set a benchmark', 'benchmark performance', 'industry benchmark'],
      },
      {
        word: 'collaborate',
        pronunciation: '/kəˈlæbəreɪt/',
        partOfSpeech: 'verb',
        meaning: 'hợp tác, cộng tác',
        descriptionEN: 'To work jointly with others or together on a shared project.',
        examples: [
          'The two companies collaborated on developing the new product.',
          'We need to collaborate more effectively across departments.',
        ],
        synonyms: ['cooperate', 'work together', 'partner', 'team up'],
        antonyms: ['compete', 'oppose'],
        collocations: ['collaborate on a project', 'collaborate with stakeholders'],
      },
      {
        word: 'deadline',
        pronunciation: '/ˈdɛdlaɪn/',
        partOfSpeech: 'noun',
        meaning: 'hạn chót, thời hạn cuối',
        descriptionEN: 'The latest time or date by which something should be completed.',
        examples: [
          'The project deadline is the end of this month.',
          'We need to meet the deadline to retain the client.',
        ],
        synonyms: ['due date', 'time limit', 'target date', 'cutoff'],
        antonyms: [],
        collocations: ['meet a deadline', 'miss a deadline', 'tight deadline'],
      },
      {
        word: 'delegate',
        pronunciation: '/ˈdɛlɪɡeɪt/',
        partOfSpeech: 'verb',
        meaning: 'ủy quyền, phân công',
        descriptionEN: 'To entrust a task or responsibility to another person.',
        examples: [
          'Good managers know how to delegate tasks effectively.',
          'She delegated the report writing to a junior team member.',
        ],
        synonyms: ['assign', 'entrust', 'hand over', 'empower'],
        antonyms: ['retain', 'micromanage'],
        collocations: ['delegate authority', 'delegate responsibility', 'delegate tasks'],
      },
      {
        word: 'facilitate',
        pronunciation: '/fəˈsɪlɪteɪt/',
        partOfSpeech: 'verb',
        meaning: 'tạo điều kiện, hỗ trợ',
        descriptionEN: 'To make an action or process easier or more achievable.',
        examples: [
          'The new software facilitates communication between remote teams.',
          'The manager facilitated the discussion during the workshop.',
        ],
        synonyms: ['enable', 'assist', 'support', 'simplify'],
        antonyms: ['hinder', 'obstruct', 'impede'],
        collocations: ['facilitate discussion', 'facilitate growth', 'facilitate communication'],
      },
      {
        word: 'leverage',
        pronunciation: '/ˈliːvərɪdʒ/',
        partOfSpeech: 'verb',
        meaning: 'tận dụng, khai thác',
        descriptionEN: 'To use something to maximum advantage in a business context.',
        examples: [
          'We can leverage our existing customer base to launch the new product.',
          'The startup leveraged social media to grow rapidly.',
        ],
        synonyms: ['utilize', 'exploit', 'capitalize on', 'harness'],
        antonyms: [],
        collocations: ['leverage technology', 'leverage resources', 'leverage expertise'],
      },
      {
        word: 'negotiate',
        pronunciation: '/nɪˈɡəʊʃieɪt/',
        partOfSpeech: 'verb',
        meaning: 'đàm phán, thương lượng',
        descriptionEN: 'To discuss something formally in order to reach an agreement.',
        examples: [
          'Both parties need to negotiate the terms of the contract.',
          'She negotiated a higher salary before accepting the job.',
        ],
        synonyms: ['bargain', 'discuss', 'mediate', 'work out'],
        antonyms: [],
        collocations: ['negotiate a deal', 'negotiate terms', 'negotiate salary'],
      },
      {
        word: 'outsource',
        pronunciation: '/ˈaʊtsɔːs/',
        partOfSpeech: 'verb',
        meaning: 'thuê ngoài, gia công',
        descriptionEN: 'To obtain goods or services from an outside supplier rather than an internal source.',
        examples: [
          'Many tech companies outsource their customer support overseas.',
          'We decided to outsource the design work to a freelancer.',
        ],
        synonyms: ['subcontract', 'contract out', 'offshore'],
        antonyms: ['in-house', 'insource'],
        collocations: ['outsource production', 'outsource IT services'],
      },
      {
        word: 'stakeholder',
        pronunciation: '/ˈsteɪkhəʊldər/',
        partOfSpeech: 'noun',
        meaning: 'các bên liên quan, cổ đông',
        descriptionEN: 'A person or group with an interest or concern in a business.',
        examples: [
          'The company consulted all key stakeholders before making the decision.',
          'Stakeholder feedback is critical to the project\'s success.',
        ],
        synonyms: ['shareholder', 'interested party', 'participant'],
        antonyms: [],
        collocations: ['key stakeholder', 'stakeholder engagement', 'stakeholder management'],
      },
    ],
  },
  {
    name: 'TOEIC Must-Know 600+',
    description: 'Từ vựng thiết yếu để đạt điểm 600+ TOEIC — tập trung vào chủ đề công sở và giao tiếp hàng ngày.',
    category: 'TOEIC',
    level: 'Intermediate',
    colorTheme: 'blue',
    tags: ['toeic', 'office', 'workplace', 'listening'],
    isPublic: true,
    words: [
      {
        word: 'accommodate',
        pronunciation: '/əˈkɒmədeɪt/',
        partOfSpeech: 'verb',
        meaning: 'đáp ứng, phù hợp; cung cấp chỗ ở',
        descriptionEN: 'To provide space or facilities for; to adjust or be able to accept something.',
        examples: [
          'The hotel can accommodate up to 500 guests.',
          'We will do our best to accommodate your request.',
        ],
        synonyms: ['house', 'provide for', 'adjust to', 'fit'],
        antonyms: ['exclude', 'reject'],
        collocations: ['accommodate a request', 'accommodate passengers', 'accommodate needs'],
      },
      {
        word: 'allocate',
        pronunciation: '/ˈæləkeɪt/',
        partOfSpeech: 'verb',
        meaning: 'phân bổ, cấp phát',
        descriptionEN: 'To distribute resources or responsibilities for a specific purpose.',
        examples: [
          'The budget has been allocated for training and development.',
          'Time must be allocated to each agenda item.',
        ],
        synonyms: ['assign', 'distribute', 'apportion', 'designate'],
        antonyms: ['withhold', 'refuse'],
        collocations: ['allocate resources', 'allocate funds', 'allocate time'],
      },
      {
        word: 'approve',
        pronunciation: '/əˈpruːv/',
        partOfSpeech: 'verb',
        meaning: 'phê duyệt, chấp thuận',
        descriptionEN: 'To officially agree to or accept something as satisfactory.',
        examples: [
          'The board approved the budget for next year.',
          'Your leave application has been approved.',
        ],
        synonyms: ['authorize', 'sanction', 'endorse', 'ratify'],
        antonyms: ['reject', 'deny', 'disapprove'],
        collocations: ['approve a budget', 'approve a request', 'pending approval'],
      },
      {
        word: 'comply',
        pronunciation: '/kəmˈplaɪ/',
        partOfSpeech: 'verb',
        meaning: 'tuân thủ, chấp hành',
        descriptionEN: 'To act in accordance with a wish, request, or rule.',
        examples: [
          'All employees must comply with company safety regulations.',
          'The supplier failed to comply with the delivery deadline.',
        ],
        synonyms: ['conform', 'adhere', 'observe', 'follow'],
        antonyms: ['disobey', 'violate', 'defy'],
        collocations: ['comply with regulations', 'comply with requirements', 'failure to comply'],
      },
      {
        word: 'confirm',
        pronunciation: '/kənˈfɜːm/',
        partOfSpeech: 'verb',
        meaning: 'xác nhận, khẳng định',
        descriptionEN: 'To state that something is definitely true or will happen.',
        examples: [
          'Please confirm your attendance by replying to this email.',
          'The manager confirmed that the meeting would go ahead.',
        ],
        synonyms: ['verify', 'validate', 'affirm', 'acknowledge'],
        antonyms: ['deny', 'cancel', 'refute'],
        collocations: ['confirm a booking', 'confirm receipt', 'confirm details'],
      },
      {
        word: 'estimate',
        pronunciation: '/ˈɛstɪmət/',
        partOfSpeech: 'noun',
        meaning: 'ước tính, dự toán',
        descriptionEN: 'An approximate calculation or judgment of value, number, or quantity.',
        examples: [
          'The contractor gave us an estimate for the renovation work.',
          'Current estimates suggest the project will take six months.',
        ],
        synonyms: ['approximation', 'calculation', 'assessment', 'quote'],
        antonyms: [],
        collocations: ['rough estimate', 'cost estimate', 'provide an estimate'],
      },
      {
        word: 'implement',
        pronunciation: '/ˈɪmplɪmɛnt/',
        partOfSpeech: 'verb',
        meaning: 'triển khai, thực thi',
        descriptionEN: 'To put a decision, plan, or agreement into effect.',
        examples: [
          'The company plans to implement the new system next quarter.',
          'It takes time to implement major organizational changes.',
        ],
        synonyms: ['execute', 'apply', 'carry out', 'enforce'],
        antonyms: ['abandon', 'cancel'],
        collocations: ['implement a strategy', 'implement changes', 'fully implement'],
      },
      {
        word: 'invoice',
        pronunciation: '/ˈɪnvɔɪs/',
        partOfSpeech: 'noun',
        meaning: 'hóa đơn',
        descriptionEN: 'A list of goods sent or services provided, with a statement of the sum due.',
        examples: [
          'Please send us the invoice by the end of the month.',
          'The invoice clearly lists all items and their costs.',
        ],
        synonyms: ['bill', 'statement', 'receipt', 'charge'],
        antonyms: [],
        collocations: ['issue an invoice', 'pay an invoice', 'invoice amount'],
      },
      {
        word: 'proceed',
        pronunciation: '/prəˈsiːd/',
        partOfSpeech: 'verb',
        meaning: 'tiến hành, tiếp tục',
        descriptionEN: 'To begin or continue an action or process.',
        examples: [
          'Once all parties sign the agreement, we can proceed.',
          'How would you like to proceed with the negotiation?',
        ],
        synonyms: ['continue', 'advance', 'go ahead', 'move forward'],
        antonyms: ['stop', 'halt', 'cease'],
        collocations: ['proceed with caution', 'proceed as planned', 'proceed to the next step'],
      },
      {
        word: 'submit',
        pronunciation: '/səbˈmɪt/',
        partOfSpeech: 'verb',
        meaning: 'nộp, gửi, đệ trình',
        descriptionEN: 'To present a document or proposal for consideration or judgment.',
        examples: [
          'Please submit your expense reports by Friday.',
          'The team submitted the proposal ahead of the deadline.',
        ],
        synonyms: ['hand in', 'present', 'file', 'send'],
        antonyms: ['withdraw', 'retract'],
        collocations: ['submit a report', 'submit an application', 'submit for approval'],
      },
    ],
  },
  {
    name: 'Everyday English Starter',
    description: 'Từ vựng thông dụng hàng ngày cho người mới bắt đầu — cảm xúc, tính cách và mô tả cuộc sống.',
    category: 'General',
    level: 'Beginner',
    colorTheme: 'rose',
    tags: ['beginner', 'daily', 'feelings', 'adjective'],
    isPublic: true,
    words: [
      {
        word: 'curious',
        pronunciation: '/ˈkjʊəriəs/',
        partOfSpeech: 'adjective',
        meaning: 'tò mò, muốn biết',
        descriptionEN: 'Eager to know or learn something.',
        examples: [
          'Children are naturally curious about the world around them.',
          'I\'m curious about how you learned to speak English so well.',
        ],
        synonyms: ['inquisitive', 'interested', 'eager', 'nosy'],
        antonyms: ['indifferent', 'uninterested', 'apathetic'],
        collocations: ['curious about', 'curious mind', 'naturally curious'],
      },
      {
        word: 'exhausted',
        pronunciation: '/ɪɡˈzɔːstɪd/',
        partOfSpeech: 'adjective',
        meaning: 'kiệt sức, mệt lả',
        descriptionEN: 'Feeling very tired; completely used up.',
        examples: [
          'After the marathon, she was completely exhausted.',
          'I\'m exhausted from working 12 hours straight.',
        ],
        synonyms: ['tired', 'worn out', 'drained', 'fatigued'],
        antonyms: ['energetic', 'refreshed', 'rested'],
        collocations: ['feel exhausted', 'utterly exhausted', 'exhausted from'],
      },
      {
        word: 'generous',
        pronunciation: '/ˈdʒɛnərəs/',
        partOfSpeech: 'adjective',
        meaning: 'hào phóng, rộng rãi',
        descriptionEN: 'Willing to give more than is expected; large or plentiful.',
        examples: [
          'It was very generous of you to share your notes with the class.',
          'The company made a generous donation to the local charity.',
        ],
        synonyms: ['kind', 'giving', 'charitable', 'open-handed'],
        antonyms: ['stingy', 'selfish', 'mean', 'greedy'],
        collocations: ['generous offer', 'generous donation', 'generous person'],
      },
      {
        word: 'nervous',
        pronunciation: '/ˈnɜːvəs/',
        partOfSpeech: 'adjective',
        meaning: 'lo lắng, hồi hộp',
        descriptionEN: 'Easily agitated or alarmed; feeling worried and anxious.',
        examples: [
          'She felt nervous before her first job interview.',
          'The nervous student kept checking the clock during the exam.',
        ],
        synonyms: ['anxious', 'worried', 'apprehensive', 'jittery'],
        antonyms: ['calm', 'confident', 'relaxed'],
        collocations: ['feel nervous', 'nervous about', 'nervous breakdown'],
      },
      {
        word: 'patient',
        pronunciation: '/ˈpeɪʃənt/',
        partOfSpeech: 'adjective',
        meaning: 'kiên nhẫn, nhẫn nại',
        descriptionEN: 'Able to accept or tolerate delay, trouble, or suffering without getting angry.',
        examples: [
          'Learning a language requires you to be patient with yourself.',
          'The teacher was very patient with the slow learners.',
        ],
        synonyms: ['tolerant', 'calm', 'persevering', 'forbearing'],
        antonyms: ['impatient', 'restless', 'irritable'],
        collocations: ['be patient with', 'patient listener', 'patient approach'],
      },
      {
        word: 'brilliant',
        pronunciation: '/ˈbrɪliənt/',
        partOfSpeech: 'adjective',
        meaning: 'xuất sắc, tuyệt vời; thông minh',
        descriptionEN: 'Exceptionally clever or talented; very bright in colour or light.',
        examples: [
          'She had a brilliant idea that solved the problem instantly.',
          'The fireworks display was absolutely brilliant.',
        ],
        synonyms: ['excellent', 'outstanding', 'clever', 'gifted'],
        antonyms: ['dull', 'ordinary', 'dim'],
        collocations: ['brilliant idea', 'brilliant student', 'absolutely brilliant'],
      },
      {
        word: 'grateful',
        pronunciation: '/ˈɡreɪtfəl/',
        partOfSpeech: 'adjective',
        meaning: 'biết ơn, cảm kích',
        descriptionEN: 'Feeling or showing thanks for something received.',
        examples: [
          'I\'m so grateful for all your help.',
          'She wrote a grateful letter to her mentor.',
        ],
        synonyms: ['thankful', 'appreciative', 'indebted'],
        antonyms: ['ungrateful', 'unappreciative'],
        collocations: ['deeply grateful', 'grateful for', 'feel grateful'],
      },
      {
        word: 'confident',
        pronunciation: '/ˈkɒnfɪdənt/',
        partOfSpeech: 'adjective',
        meaning: 'tự tin, chắc chắn',
        descriptionEN: 'Feeling certain about your ability to do things well; showing certainty.',
        examples: [
          'You need to be more confident when speaking in public.',
          'She walked into the meeting room with a confident smile.',
        ],
        synonyms: ['assured', 'self-assured', 'certain', 'bold'],
        antonyms: ['insecure', 'uncertain', 'timid'],
        collocations: ['feel confident', 'confident in', 'self-confident'],
      },
    ],
  },
];

// ─── Main Seed Function ───────────────────────────────────────────────────────
async function seed() {
  const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';
  if (!mongoUri) { console.error('✗ Không tìm thấy MONGO_URI'); process.exit(1); }

  console.log('\n🌱 MinLish Seed v2 — Bắt đầu...\n');

  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Kết nối Atlas thành công\n');

    // ──────────────────────────────────────────────────────────────────────────
    // BƯỚC 1: XÓA 2 SET CŨ
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🗑️  Bước 1: Xóa các bộ từ cũ...');
    const oldSetNames = ['IELTS', 'IELTS sieu cap toc'];
    for (const name of oldSetNames) {
      const result = await VocabularySet.deleteOne({ name });
      if (result.deletedCount > 0) {
        console.log(`   ✓ Đã xóa set: "${name}"`);
      } else {
        console.log(`   - Không tìm thấy set: "${name}" (bỏ qua)`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BƯỚC 2: TẠO USER PROFILES cho users hiện có
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n👤 Bước 2: Tạo UserProfiles...');
    const allUsers = await User.find().lean();

    const profileDefaults = [
      { email: 'admin@minlish.com',  learningGoal: 'general',  targetLevel: 'C2', currentLevel: 'advanced', dailyGoal: 5,  reviewPerDay: 10 },
      { email: 'user@minlish.com',   learningGoal: 'ielts',    targetLevel: 'B2', currentLevel: 'intermediate', dailyGoal: 10, reviewPerDay: 20 },
    ];

    for (const user of allUsers) {
      const preset = profileDefaults.find(p => p.email === user.email);
      await UserProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId: user._id,
            learningGoal: preset?.learningGoal ?? 'general',
            targetLevel: preset?.targetLevel ?? 'B1',
            currentLevel: preset?.currentLevel ?? 'beginner',
            dailyGoal: preset?.dailyGoal ?? 10,
            reviewPerDay: preset?.reviewPerDay ?? 20,
            reminderTime: '20:00',
            timezone: 'Asia/Ho_Chi_Minh',
            preferences: { emailNotification: true, pushNotification: true, soundEffect: true },
          },
        },
        { upsert: true }
      );
      console.log(`   ✓ Profile: ${user.email}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BƯỚC 3: TẠO 5 BỘ TỪ VỰNG + WORDS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📚 Bước 3: Tạo VocabularySets và Words...');
    const adminUser = await User.findOne({ role: 'admin' }).lean();
    if (!adminUser) throw new Error('Không tìm thấy admin user');

    const createdSetIds: Types.ObjectId[] = [];

    for (const setData of SETS_DATA) {
      // Kiểm tra set đã tồn tại chưa
      const existing = await VocabularySet.findOne({ name: setData.name });
      if (existing) {
        console.log(`   ⚠  Đã tồn tại: "${setData.name}" — bỏ qua`);
        createdSetIds.push(existing._id as Types.ObjectId);
        continue;
      }

      const { words, ...setFields } = setData;

      const newSet = await VocabularySet.create({
        ...setFields,
        userId: adminUser._id,
        totalWords: 0,
        learnerCount: 0,
        isDeleted: false,
      });

      // Tạo words cho set này
      let wordCount = 0;
      for (const wordData of words) {
        const wordExists = await Word.findOne({ setId: newSet._id, word: wordData.word });
        if (wordExists) continue;

        await Word.create({
          setId: newSet._id,
          ...wordData,
          audioUrl: tts(wordData.word),
          imageUrl: img(wordData.word),
          isDeleted: false,
        });
        wordCount++;
      }

      // Cập nhật totalWords
      await VocabularySet.findByIdAndUpdate(newSet._id, { $set: { totalWords: wordCount } });
      createdSetIds.push(newSet._id as Types.ObjectId);
      console.log(`   ✓ "${setData.name}" — ${wordCount} từ`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BƯỚC 4: LEARNING PROGRESS cho demo user
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🎯 Bước 4: Tạo LearningProgress cho demo user...');
    const demoUser = await User.findOne({ email: 'user@minlish.com' }).lean();

    if (demoUser) {
      const allWords = await Word.find({
        setId: { $in: createdSetIds },
        isDeleted: { $ne: true }
      }).lean();

      const progressWords = allWords.slice(0, 25); // Lấy 25 từ đầu để tạo progress

      const statuses: Array<'learning' | 'review' | 'mastered'> = [
        'mastered','mastered','mastered','mastered','mastered',  // 5 mastered
        'review','review','review','review','review',            // 5 review
        'learning','learning','learning','learning','learning',  // 5 learning
        'review','mastered','learning','review','mastered',      // 5 mixed
        'learning','review','mastered','learning','review',      // 5 mixed
      ];

      let progressCount = 0;
      for (let i = 0; i < progressWords.length; i++) {
        const word = progressWords[i];
        const status = statuses[i] ?? 'learning';
        const daysAgo = Math.floor(Math.random() * 20);

        const efMap = { mastered: 2.8, review: 2.3, learning: 1.8 };
        const intervalMap = { mastered: 21, review: 7, learning: 1 };
        const repMap = { mastered: 8, review: 4, learning: 1 };

        const nextReview = new Date();
        if (status === 'mastered') nextReview.setDate(nextReview.getDate() + 21);
        else if (status === 'review') nextReview.setDate(nextReview.getDate() + Math.floor(Math.random() * 5));
        else nextReview.setDate(nextReview.getDate() + 1);

        const lastReview = new Date();
        lastReview.setDate(lastReview.getDate() - daysAgo);

        const totalReviews = repMap[status] + Math.floor(Math.random() * 3);
        const correctReviews = Math.floor(totalReviews * (status === 'mastered' ? 0.95 : status === 'review' ? 0.75 : 0.5));

        await LearningProgress.findOneAndUpdate(
          { userId: demoUser._id, wordId: word._id },
          {
            $setOnInsert: {
              userId: demoUser._id,
              wordId: word._id,
              setId: word.setId,
              status,
              easeFactor: efMap[status],
              interval: intervalMap[status],
              repetitions: repMap[status],
              nextReviewDate: nextReview,
              lastReviewDate: lastReview,
              lastRating: status === 'mastered' ? 'easy' : status === 'review' ? 'good' : 'hard',
              totalReviews,
              correctReviews,
            },
          },
          { upsert: true }
        );
        progressCount++;
      }
      console.log(`   ✓ Đã tạo ${progressCount} LearningProgress records cho user@minlish.com`);

      // ────────────────────────────────────────────────────────────────────────
      // BƯỚC 5: DAILY STATS — 30 ngày lịch sử
      // ────────────────────────────────────────────────────────────────────────
      console.log('\n📊 Bước 5: Tạo DailyStats 30 ngày...');
      let statsCount = 0;
      for (let d = 29; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        date.setHours(0, 0, 0, 0);

        const isActive = d > 2 ? Math.random() > 0.2 : true; // 80% ngày có học, 3 ngày gần nhất luôn học
        if (!isActive) continue;

        const wordsReviewed   = Math.floor(Math.random() * 15) + 8;   // 8-22
        const newWordsLearned = Math.floor(Math.random() * 8) + 2;    // 2-9
        const totalAnswers    = wordsReviewed;
        const correctAnswers  = Math.floor(totalAnswers * (0.65 + Math.random() * 0.3)); // 65-95%
        const timeSpent       = wordsReviewed * (25 + Math.floor(Math.random() * 20));  // 25-45s/từ

        await DailyStats.findOneAndUpdate(
          { userId: demoUser._id, date },
          {
            $setOnInsert: {
              userId: demoUser._id,
              date,
              wordsReviewed,
              newWordsLearned,
              totalAnswers,
              correctAnswers,
              timeSpent,
              streak: Math.max(0, 30 - d),
            },
          },
          { upsert: true }
        );
        statsCount++;
      }
      console.log(`   ✓ Đã tạo ${statsCount} DailyStats records (30 ngày)`);

    } else {
      console.log('   ⚠  Không tìm thấy user@minlish.com — bỏ qua LearningProgress & DailyStats');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BƯỚC 6: NOTIFICATIONS mẫu
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🔔 Bước 6: Tạo Notifications mẫu...');
    if (demoUser) {
      const notifExisting = await Notification.countDocuments({ userId: demoUser._id });
      if (notifExisting === 0) {
        const sampleNotifs = [
          {
            userId: demoUser._id,
            type: 'daily_reminder',
            title: '⏰ Đến giờ ôn tập rồi!',
            message: 'Bạn có 12 từ cần ôn tập hôm nay. Chỉ mất 10 phút thôi!',
            isRead: false,
          },
          {
            userId: demoUser._id,
            type: 'achievement',
            title: '🏆 Chúc mừng! Bạn đã thuộc 10 từ!',
            message: 'Tuyệt vời! Bạn vừa đạt cột mốc 10 từ đã mastered. Tiếp tục nhé!',
            isRead: false,
          },
          {
            userId: demoUser._id,
            type: 'streak_milestone',
            title: '🔥 Streak 7 ngày liên tiếp!',
            message: 'Bạn đã học 7 ngày liên tiếp. Đừng để streak bị gián đoạn!',
            isRead: true,
          },
          {
            userId: demoUser._id,
            type: 'system',
            title: '👋 Chào mừng đến với MinLish!',
            message: 'Tài khoản của bạn đã được kích hoạt. Bắt đầu học từ đầu tiên ngay nào!',
            isRead: true,
          },
        ];
        await Notification.insertMany(sampleNotifs);
        console.log(`   ✓ Đã tạo ${sampleNotifs.length} thông báo mẫu`);
      } else {
        console.log(`   ⚠  Đã có ${notifExisting} thông báo — bỏ qua`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TỔNG KẾT
    // ──────────────────────────────────────────────────────────────────────────
    const finalSets  = await VocabularySet.countDocuments({ isDeleted: { $ne: true } });
    const finalWords = await Word.countDocuments({ isDeleted: { $ne: true } });
    const finalProg  = await LearningProgress.countDocuments();
    const finalStats = await DailyStats.countDocuments();
    const finalNotif = await Notification.countDocuments();

    console.log('\n' + '═'.repeat(55));
    console.log('✅ Seed hoàn tất!\n');
    console.log('   VocabularySets    :', finalSets);
    console.log('   Words             :', finalWords);
    console.log('   LearningProgress  :', finalProg);
    console.log('   DailyStats        :', finalStats);
    console.log('   Notifications     :', finalNotif);
    console.log('\n📱 API test ngay:');
    console.log('   Login : POST /api/v1/auth/login');
    console.log('   Email : user@minlish.com | Pass: User@123');
    console.log('   Swagger: http://localhost:3000/api-docs\n');

  } catch (err: any) {
    console.error('\n✗ Seed thất bại:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Đã ngắt kết nối\n');
  }
}

seed();

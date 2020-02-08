import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Task {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: false, readonly: true })
    groupId: string;

    @Column({ nullable: false })
    description: string;

    @Column({ type: 'text', nullable: true })
    processRecord: string;

    @Column({ default: 'notice' })
    type: string; // 自动提醒notice, 备忘录memory, 任务task, 

    @Column({ default: 1, nullable: false })
    status: number;

    @CreateDateColumn()
    createdTime: number;

    @Column({ type: 'text', nullable: true })
    imageList: string;

    @Column({ type: 'text', nullable: true })
    autoRemindConfig: string;

    @Column({ nullable: false })
    createdDate: string;
}